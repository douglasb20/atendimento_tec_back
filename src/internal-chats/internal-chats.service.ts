import { randomUUID } from 'crypto';

import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { EstadoPresenca, PresencaService } from '@/presenca/presenca.service';
import { PresignedUpload, StorageService } from '@/storage/storage.service';
import { UserRepository } from '@/users/users.repository';
import { runInTransaction } from 'Utils';
import { WhatsappGateway } from '@/whatsapp/whatsapp.gateway';
import { SendInternalMessageDto } from './dto/send-internal-message.dto';
import { SignInternalMediaDto } from './dto/sign-internal-media.dto';
import { InternalChatMessages } from './entities/internal-chat-messages.entity';
import { InternalChats } from './entities/internal-chats.entity';
import { ehSuperusuario, ehTipoComMidia } from './internal-chat.types';
import { ConversaComResumo, InternalChatsRepository } from './internal-chats.repository';

/** Um colega na lista, com o estado de presença. */
export type ColegaResponse = {
  id: number;
  name: string;
  last_name: string | null;
  avatar_url: string | null;
  /** Conectado, em qualquer estado. Mantido por compatibilidade. */
  online: boolean;
  /** `ausente` sai do tempo sem interação - ver `PresencaService`. */
  estado: EstadoPresenca;
};

/** Quantas mensagens o histórico devolve quando o front não pede outro tanto. */
const LIMITE_PADRAO = 50;

@Injectable()
export class InternalChatsService {
  private readonly logger = new Logger(InternalChatsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly repository: InternalChatsRepository,
    private readonly userRepository: UserRepository,
    private readonly storageService: StorageService,
    private readonly presencaService: PresencaService,
    private readonly gateway: WhatsappGateway,
  ) {}

  /**
   * Os colegas com quem dá para conversar.
   *
   * Sai de `findActives()`, que já exclui inativos **e o superusuário**, menos
   * o próprio solicitante - conversa consigo mesmo o banco recusa, e oferecê-la
   * na lista seria oferecer um erro.
   *
   * O master fica de fora nas duas pontas: não aparece aqui e não pode chamar
   * esta rota. Ver `exigirParticipanteDoChat`.
   */
  async listarColegas(usuarioId: number): Promise<ColegaResponse[]> {
    await this.exigirParticipanteDoChat(usuarioId);

    const usuarios = await this.userRepository.findActives();

    return usuarios
      .filter((usuario) => usuario.id !== usuarioId)
      .map((usuario) => ({
        id: usuario.id,
        name: usuario.name,
        last_name: usuario.last_name ?? null,
        // A coluna guarda a key; quem consome precisa da URL.
        avatar_url: usuario.avatar_url
          ? this.storageService.getPublicUrl(usuario.avatar_url)
          : null,
        online: this.presencaService.estaOnline(usuario.id),
        estado: this.presencaService.estado(usuario.id),
      }));
  }

  /** As conversas do usuário, com a última mensagem e o contador de não lidas. */
  async listarConversas(usuarioId: number): Promise<ConversaComResumo[]> {
    await this.exigirParticipanteDoChat(usuarioId);

    const conversas = await this.repository.listarConversas(usuarioId);

    return conversas.map((conversa) => ({
      ...conversa,
      outro: this.comAvatarPublico(conversa.outro),
      ultima_mensagem: conversa.ultima_mensagem
        ? this.comUrlPublica(conversa.ultima_mensagem)
        : null,
    }));
  }

  /**
   * O histórico de uma conversa.
   *
   * ⚠️ `internal.chat:view` autoriza *usar* o chat interno, não ler a conversa
   * dos outros. Sem a checagem abaixo, trocar o id na URL entregaria qualquer
   * conversa a qualquer um.
   */
  async listarMensagens(
    conversaId: number,
    usuarioId: number,
    limite = LIMITE_PADRAO,
    antesDe?: Date,
  ): Promise<InternalChatMessages[]> {
    await this.exigirParticipacao(conversaId, usuarioId);

    const mensagens = await this.repository.listarMensagens(conversaId, limite, antesDe);

    return mensagens.map((mensagem) => this.comUrlPublica(mensagem));
  }

  /**
   * Envia uma mensagem para um colega.
   *
   * A conversa nasce aqui se ainda não existir, no mesmo commit da mensagem:
   * criar a conversa e falhar ao gravar a mensagem deixaria uma linha vazia na
   * lista do outro.
   */
  async enviar(
    destinatarioId: number,
    remetenteId: number,
    dto: SendInternalMessageDto,
  ): Promise<InternalChatMessages> {
    if (destinatarioId === remetenteId) {
      throw new BadRequestException('Não é possível conversar consigo mesmo');
    }

    await this.exigirParticipanteDoChat(remetenteId);

    // `findById` já lança se não existir ou estiver inativo.
    const destinatario = await this.userRepository.findById(destinatarioId);

    // A outra ponta também: `findActives()` já omite o master da lista de
    // colegas, mas sem esta checagem a rota aceitaria o id digitado à mão - e
    // nasceria uma conversa que nenhum dos dois lados consegue listar.
    if (ehSuperusuario(destinatario)) {
      throw new BadRequestException('Este usuário não participa do chat interno');
    }

    const temMidia = ehTipoComMidia(dto.type);

    const mensagem = await runInTransaction(this.dataSource, async (manager) => {
      const conversa = await this.repository.findOrCreateConversa(
        manager,
        remetenteId,
        destinatarioId,
      );

      const salva = await manager.save(
        manager.create(InternalChatMessages, {
          internal_chat_id: conversa.id,
          sender_id: remetenteId,
          type: dto.type,
          content: dto.content ?? null,
          has_media: temMidia,
          media_url: temMidia ? dto.media_key : null,
          media_type: temMidia ? (dto.mimetype ?? null) : null,
          media_size: temMidia ? (dto.media_size ?? null) : null,
          file_name: temMidia ? (dto.file_name ?? null) : null,
        }),
      );

      // Ordena a lista sem agregar as mensagens a cada abertura da tela.
      await manager.update(InternalChats, conversa.id, { last_message_at: salva.created_at });

      // Releitura pelo manager da transação, para a mensagem sair com o
      // remetente carregado - é o que o front precisa para montar a bolha.
      return manager.findOne(InternalChatMessages, {
        where: { id: salva.id },
        relations: ['sender'],
      });
    });

    const paraOFront = this.comUrlPublica(mensagem);

    // `emitToUser`, nunca broadcast: conversa privada não vai para a sala de
    // todos. Aos dois lados, porque o remetente pode ter outras abas abertas.
    for (const destino of [destinatarioId, remetenteId]) {
      this.gateway.emitToUser(destino, 'interno:mensagem', paraOFront);
    }

    this.logger.log(`Mensagem interna ${mensagem.id}: ${remetenteId} -> ${destinatarioId}`);

    return paraOFront;
  }

  /** Marca como lidas as mensagens que o outro mandou nesta conversa. */
  async marcarLidas(conversaId: number, usuarioId: number): Promise<{ lidas: number }> {
    const conversa = await this.exigirParticipacao(conversaId, usuarioId);

    const lidas = await this.repository.marcarLidas(conversaId, usuarioId);

    if (lidas > 0) {
      const outro = conversa.user_a_id === usuarioId ? conversa.user_b_id : conversa.user_a_id;

      // O outro lado atualiza os ticks; o próprio usuário zera o badge nas
      // demais abas.
      this.gateway.emitToUser(outro, 'interno:lida', { chat_id: conversaId, por: usuarioId });
      this.gateway.emitToUser(usuarioId, 'interno:lida', { chat_id: conversaId, por: usuarioId });
    }

    return { lidas };
  }

  /** Total de não lidas do usuário - alimenta o badge geral. */
  async contarNaoLidas(usuarioId: number): Promise<{ total: number }> {
    await this.exigirParticipanteDoChat(usuarioId);

    return { total: await this.repository.contarNaoLidasTotal(usuarioId) };
  }

  /**
   * URL assinada para o front subir um arquivo direto ao storage.
   *
   * Prefixo próprio (`chat-interno/`) para separar do que é de atendimento: a
   * retenção de cada um tem prazo próprio, e misturar tornaria impossível
   * distinguir pelo caminho.
   */
  async assinarMidia(dto: SignInternalMediaDto): Promise<PresignedUpload> {
    const extensao = dto.fileType.split('/')[1];

    if (!extensao) throw new BadRequestException('Tipo de arquivo inválido');

    return this.storageService.createPresignedPost(
      `chat-interno/${randomUUID()}.${extensao}`,
      dto.fileType,
    );
  }

  /**
   * Garante que quem chama participa do chat interno.
   *
   * O superusuário não participa: é a conta de instalação do sistema, não um
   * atendente, e `UserRepository.findActives()` já o omite da lista de colegas
   * pelo mesmo motivo. Barrar só na tela deixaria a API respondendo a quem
   * chamasse direto.
   *
   * ⚠️ É a única checagem do módulo que o `PermissionGuard` **não** cobre - ele
   * libera o superusuário de tudo, antes de olhar permissão. Aqui a regra é o
   * contrário: ele é justamente quem não entra.
   */
  private async exigirParticipanteDoChat(usuarioId: number): Promise<void> {
    const usuario = await this.userRepository.findById(usuarioId);

    if (ehSuperusuario(usuario)) {
      throw new ForbiddenException('O usuário master não participa do chat interno');
    }
  }

  /**
   * Garante que o usuário é uma das duas pontas da conversa.
   *
   * `Forbidden` e não `NotFound`: a conversa existe, quem pergunta é que não
   * tem nada com ela.
   */
  private async exigirParticipacao(conversaId: number, usuarioId: number): Promise<InternalChats> {
    await this.exigirParticipanteDoChat(usuarioId);

    const conversa = await this.repository.findMinhaConversa(conversaId, usuarioId);

    if (!conversa) {
      this.logger.warn(`Usuário ${usuarioId} tentou acessar a conversa interna ${conversaId}`);
      throw new ForbiddenException('Esta conversa não é sua');
    }

    return conversa;
  }

  /** A key do storage vira URL pública - o front renderiza o que recebe. */
  private comUrlPublica(mensagem: InternalChatMessages): InternalChatMessages {
    if (mensagem.sender) mensagem.sender = this.comAvatarPublico(mensagem.sender);

    // Mídia expirada não tem arquivo: devolver URL apontaria para o vazio.
    if (!mensagem.has_media || !mensagem.media_url || mensagem.media_expired) return mensagem;

    return { ...mensagem, media_url: this.storageService.getPublicUrl(mensagem.media_url) };
  }

  private comAvatarPublico<T extends { avatar_url?: string | null }>(usuario: T): T {
    if (!usuario?.avatar_url) return usuario;

    return { ...usuario, avatar_url: this.storageService.getPublicUrl(usuario.avatar_url) };
  }
}
