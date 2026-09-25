import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';

import { comDdiBrasil, ContactsService } from '@/contacts/contacts.service';
import { ContactsRepository } from '@/contacts/contacts.repository';
import { WhatsappService } from '@/whatsapp/whatsapp.service';
import {
  MessageEditPayload,
  MessagePayload,
  MessageTypes,
  SupportChatStatusId,
  ReactionPayload,
  WhatsappWebhookPayload,
} from '@types';

import { Contacts } from '@/contacts/entities/contacts.entity';
import { nomeCompleto, runInTransaction, separaNome } from '@/Utils';
import { SupportChats } from './entities/support-chats.entity';
import { MessagesService } from './messages/messages.service';
import { SupportChatsRepository } from './support-chats.repository';
import { PresignedUpload, StorageService } from '@/storage/storage.service';
import { ChannelsRepository } from '@/channels/channels.repository';
import { SignMediaPostDto } from './dto/sign-media-post.dto';
import { SendMediaDto, SendMediaType } from './dto/send-media.dto';
import { FinalizarAtendimentoDto } from './dto/finalizar-atendimento.dto';
import { FinalizarSemAtendimentoDto } from './dto/finalizar-sem-atendimento.dto';
import { TransferirAtendimentoDto } from './dto/transferir-atendimento.dto';
import { CreateSupportChatDto } from './dto/create-support-chat.dto';
import { SupportChatEvents } from './entities/support-chat-events.entity';
import { SupportChatEventsRepository } from './support-chat-events.repository';
import { montaMensagemAutomatica } from './mensagens-automaticas';
import { UserRepository } from '@/users/users.repository';
import { ServiceAlertsService } from '@/service-alerts/service-alerts.service';
import { ChatbotsRepository } from '@/chatbots/chatbots.repository';
import { ChatbotFlowExecutionsService } from '@/chatbot-engine/chatbot-flow-executions.service';
import { ChatbotFlowExecutionsRepository } from '@/chatbot-engine/chatbot-flow-executions.repository';
import { Channels } from '@/channels/entities/channels.entity';
import { DepartmentsRepository } from '@/departments/departments.repository';
import { Departments } from '@/departments/entities/departments.entity';

/**
 * Tipo de mídia do envio → tipo interno persistido, o mesmo que o webhook
 * grava. Exportado: o `ExecutionEngine` do chatbot reaproveita este mapa em
 * vez de duplicá-lo.
 */
export const TIPO_INTERNO_POR_MIDIA: Record<SendMediaType, MessageTypes> = {
  [SendMediaType.IMAGE]: MessageTypes.IMAGE,
  [SendMediaType.VIDEO]: MessageTypes.VIDEO,
  [SendMediaType.AUDIO]: MessageTypes.AUDIO,
  [SendMediaType.VOICE]: MessageTypes.VOICE,
  [SendMediaType.DOCUMENT]: MessageTypes.DOCUMENT,
  [SendMediaType.STICKER]: MessageTypes.STICKER,
};

@Injectable()
export class SupportChatsService {
  private readonly logger = new Logger(SupportChatsService.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly messagesService: MessagesService,
    private readonly channelsRepository: ChannelsRepository,
    private readonly contactsService: ContactsService,
    private readonly supportChatsRepository: SupportChatsRepository,
    private readonly supportChatEventsRepository: SupportChatEventsRepository,
    private readonly userRepository: UserRepository,
    private readonly storageService: StorageService,
    private readonly serviceAlertsService: ServiceAlertsService,
    private readonly dataSource: DataSource,
    private readonly chatbotsRepository: ChatbotsRepository,
    @Inject(forwardRef(() => ChatbotFlowExecutionsService))
    private readonly chatbotFlowExecutionsService: ChatbotFlowExecutionsService,
    private readonly chatbotFlowExecutionsRepository: ChatbotFlowExecutionsRepository,
    private readonly departmentsRepository: DepartmentsRepository,
    private readonly contactsRepository: ContactsRepository,
  ) {}

  /**
   * Envia uma mensagem que o sistema decidiu mandar, sem atendente por trás.
   *
   * Caminho separado do `sendMessage`, e não um parâmetro nele, por três
   * motivos que não cabem no fluxo normal:
   *
   * 1. **Sem o guard de dono.** `carregaParaEscrita` exige que a conversa tenha
   *    dono e que seja quem chama - e a saudação sai justamente numa conversa
   *    recém-criada, que ainda não tem dono nenhum.
   * 2. **Sem marcar como lida.** O `registraEnvio` zera `unread_count` e manda
   *    o tique azul ao cliente. Numa saudação isso apagaria o aviso da
   *    mensagem que o contato acabou de mandar - a conversa sumiria da fila
   *    sem ninguém ter atendido.
   * 3. **Sem o prefixo de autor.** O `*Nome:*` identifica quem respondeu, e
   *    aqui não respondeu ninguém.
   *
   * ⚠️ **Nunca propaga erro.** É cortesia: falhar o envio não pode derrubar o
   * processamento da mensagem do cliente nem impedir a finalização.
   */
  /**
   * Os avisos ativos do canal, logo depois da saudação.
   *
   * O caso de uso: um serviço externo cai (a Sefaz, por exemplo) e todo mundo
   * chama pelo mesmo motivo. O aviso chega antes de a pessoa digitar a dúvida.
   *
   * ⚠️ **Só na abertura**, como a saudação: quem já está conversando não recebe
   * aviso no meio do atendimento.
   *
   * Uma mensagem por aviso, em sequência - dois problemas simultâneos são dois
   * assuntos distintos, e juntá-los num texto só embaralharia os dois.
   *
   * ⚠️ **Nunca propaga erro**, como todo o resto do envio automático: uma falha
   * aqui não pode derrubar o processamento da mensagem do cliente.
   */
  private async enviaAvisosAtivos(supportChat: SupportChats): Promise<void> {
    if (!supportChat?.channel_id) return;

    try {
      const avisos = await this.serviceAlertsService.ativosParaCanal(supportChat.channel_id);

      // Sequencial, não `Promise.all`: o WhatsApp entrega na ordem em que
      // recebe, e em paralelo os avisos chegariam embaralhados entre si.
      for (const aviso of avisos) {
        await this.enviaMensagemAutomatica(supportChat, aviso.mensagem);
      }

      if (avisos.length) {
        this.logger.log(`Conversa ${supportChat.id}: ${avisos.length} aviso(s) enviado(s)`);
      }
    } catch (err) {
      this.logger.warn(`Falha ao enviar avisos da conversa ${supportChat.id}: ${err.message}`);
    }
  }

  /**
   * Decide o texto de abertura da conversa quando não há chatbot ativo no
   * canal: a saudação normal, ou a mensagem de ausência de algum setor
   * vinculado, se todos estiverem fora do horário.
   *
   * Regra de **união**: canal considerado disponível se **qualquer** setor
   * vinculado estiver dentro do horário agora (mesmo padrão de Zendesk/
   * Intercom/WhatsApp Business - evita o falso "estamos fechados" quando só
   * uma das áreas está de folga). Setor sem nenhum intervalo cadastrado conta
   * como sempre disponível. Canal sem setor vinculado nenhum não muda em
   * nada - comportamento de hoje, sempre a saudação.
   *
   * Quando todos os setores estão fora do horário, a mensagem usada é a do
   * **primeiro setor vinculado** (menor `id`) - decisão do usuário, evita
   * concatenar textos de vários setores fechados ao mesmo tempo.
   */
  private async decideMensagemDeAbertura(channel: Channels): Promise<string | null | undefined> {
    const setores = await this.dataSource
      .createQueryBuilder()
      .relation(Channels, 'departments')
      .of(channel.id)
      .loadMany<Departments>();

    if (!setores.length) return channel.mensagem_saudacao;

    setores.sort((a, b) => a.id - b.id);

    const agora = new Date();
    const diaAtual = agora.getDay();
    const horaAtual = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}:00`;

    let primeiroFechado: Departments | null = null;

    for (const setor of setores) {
      const intervalos = await this.departmentsRepository.findSchedule(setor.id);

      const disponivel =
        intervalos.length === 0 ||
        intervalos.some(
          (i) => i.weekday === diaAtual && i.start_time <= horaAtual && horaAtual < i.end_time,
        );

      if (disponivel) return channel.mensagem_saudacao;

      if (!primeiroFechado) primeiroFechado = setor;
    }

    return primeiroFechado?.absence_message ?? channel.mensagem_saudacao;
  }

  private async enviaMensagemAutomatica(
    supportChat: SupportChats,
    texto: string | null | undefined,
  ): Promise<void> {
    const mensagem = montaMensagemAutomatica(texto, supportChat);
    if (!mensagem) return;

    try {
      const destino = supportChat.contact?.remote_jid;
      if (!destino) {
        this.logger.warn(`Conversa ${supportChat.id} sem remote_jid: mensagem automática ignorada`);
        return;
      }

      const enviadoEm = new Date();
      const enviada = await this.whatsappService.sendMessage(
        supportChat.channel.session_id,
        destino,
        mensagem,
      );

      await runInTransaction(this.dataSource, (manager) =>
        this.messagesService.saveOutgoing(
          {
            messageId: enviada.messageId,
            channel: supportChat.channel,
            supportChat,
            to: destino,
            content: mensagem,
            type: MessageTypes.TEXT,
            sentAt: enviadoEm,
          },
          manager,
        ),
      );

      this.logger.log(`Mensagem automática enviada na conversa ${supportChat.id}`);
    } catch (err) {
      this.logger.warn(`Falha ao enviar mensagem automática: ${err.message}`);
    }
  }

  /**
   * Carrega a conversa e garante que quem escreve é quem a atende.
   *
   * Até aqui qualquer autenticado com `support.chat:update` respondia em
   * qualquer conversa, inclusive numa que outro atendente estivesse conduzindo
   * - e o cliente recebia duas vozes no mesmo atendimento. O front esconde os
   * controles; esta é a garantia de quem chama a API direto.
   *
   * ⚠️ Não vale para `marcarComoLida` nem para a leitura: acompanhar a conversa
   * de um colega é legítimo, escrever nela não é.
   */
  private async carregaParaEscrita(
    id: number,
    user_id: number,
    relations: string[] = ['channel', 'contact'],
  ): Promise<SupportChats> {
    const supportChat = await this.supportChatsRepository.findOne({
      where: { id },
      relations,
    });
    if (!supportChat) {
      throw new NotFoundException('Chat de suporte não encontrado');
    }

    if (supportChat.user_id === null) {
      throw new BadRequestException('Inicie o atendimento antes de responder');
    }

    if (Number(supportChat.user_id) !== Number(user_id)) {
      throw new ForbiddenException('Este atendimento está com outro atendente');
    }

    return supportChat;
  }

  async sendMessage(id: number, user_id: number, chat_id: string, message: string) {
    this.logger.log(`Enviando mensagem de para ${chat_id} com mensagem: ${message}`);

    // `contact` vem junto: é necessário para marcar as lidas no WhatsApp.
    const supportChat = await this.carregaParaEscrita(id, user_id);

    const enviadoEm = new Date();
    const sentMessage = await this.whatsappService.sendMessage(
      supportChat.channel.session_id,
      chat_id,
      message,
    );
    await this.registraEnvio({
      messageId: sentMessage.messageId,
      supportChat,
      to: chat_id,
      content: message,
      type: MessageTypes.TEXT,
      sentAt: enviadoEm,
    });

    // O id volta para o front casar a mensagem otimista (exibida na hora) com a
    // definitiva, que chega depois pelo webhook.
    return { status: 'message sent', message_id: sentMessage.messageId };
  }

  async replyMessage(
    id: number,
    user_id: number,
    chat_id: string,
    messageId: string,
    message: string,
  ) {
    this.logger.log(`Enviando mensagem de para ${chat_id} com mensagem: ${message}`);
    // `contact` vem junto: é necessário para marcar as lidas no WhatsApp.
    const supportChat = await this.carregaParaEscrita(id, user_id);

    const enviadoEm = new Date();
    const sentMessage = await this.whatsappService.replyMessage(
      supportChat.channel.session_id,
      chat_id,
      messageId,
      message,
    );
    await this.registraEnvio({
      messageId: sentMessage.messageId,
      supportChat,
      to: chat_id,
      content: message,
      type: MessageTypes.TEXT,
      quotedMsgId: messageId,
      sentAt: enviadoEm,
    });

    return { status: 'message sent', message_id: sentMessage.messageId };
  }

  /**
   * Envia mídia para a conversa.
   *
   * O arquivo já está no storage (subido pelo front via URL assinada); daqui só
   * segue a URL pública, que o provider usa para baixar. É o que permite enviar
   * vídeos grandes: nada de base64 no corpo nem browser headless no caminho.
   */
  async sendMedia(id: number, user_id: number, sendMediaDto: SendMediaDto) {
    const { chat_id, media_key, media_type, mimetype, caption, file_name, quoted_message_id } =
      sendMediaDto;

    // `contact` vem junto: é necessário para marcar as lidas no WhatsApp.
    const supportChat = await this.carregaParaEscrita(id, user_id);

    const mediaUrl = this.storageService.getPublicUrl(media_key);
    this.logger.log(`Enviando ${media_type} para ${chat_id}`);

    const enviadoEm = new Date();
    const sentMessage = await this.whatsappService.sendMedia(supportChat.channel.session_id, {
      to: chat_id,
      mediaType: media_type,
      media: mediaUrl,
      mimetype,
      caption,
      fileName: file_name,
      quotedMessageId: quoted_message_id,
    });

    // Antes de qualquer escrita no banco: a Evolution dispara o webhook no
    // mesmo instante em que responde aqui, e a transação do `registraEnvio`
    // chega a perder a corrida - o webhook então não acha a linha provisória e
    // baixa de volta a mídia que nós mesmos acabamos de subir. Um SET no Redis
    // ganha da transação com folga.
    await this.messagesService.reservaEnvioComMidia(sentMessage.messageId, {
      mediaKey: media_key,
      mimetype,
    });

    await this.registraEnvio({
      messageId: sentMessage.messageId,
      supportChat,
      to: chat_id,
      content: caption ?? '',
      type: TIPO_INTERNO_POR_MIDIA[media_type],
      mediaUrl: media_key,
      mediaType: mimetype,
      fileName: file_name,
      quotedMsgId: quoted_message_id,
      sentAt: enviadoEm,
    });

    return { status: 'media sent', message_id: sentMessage.messageId };
  }

  /**
   * Persiste a mensagem recém-enviada, sem deixar a falha derrubar o envio: o
   * provider já aceitou, e o webhook ainda vai gravá-la de todo modo.
   */
  private async registraEnvio(dados: {
    messageId: string;
    supportChat: SupportChats;
    to: string;
    content: string;
    type: MessageTypes;
    mediaUrl?: string;
    mediaType?: string;
    fileName?: string;
    quotedMsgId?: string;
    sentAt: Date;
  }) {
    try {
      await runInTransaction(this.dataSource, (manager) =>
        this.messagesService.saveOutgoing(
          { ...dados, channel: dados.supportChat.channel },
          manager,
        ),
      );
    } catch (err) {
      this.logger.warn(`Não foi possível registrar o envio ${dados.messageId}: ${err.message}`);
    }

    // Responder é a prova de que o atendente leu: só aí a contagem zera.
    // Abrir a conversa não basta - ele pode abrir, ler pela metade e sair, e o
    // pendente continua pendente até alguém de fato responder.
    //
    // Fora do try acima de propósito: falhar ao gravar a mensagem não impede
    // que a resposta tenha sido enviada, e a contagem precisa refletir isso.
    try {
      // Sem checar o valor em memória antes: o `supportChat` foi carregado no
      // início do envio e pode já estar defasado se chegou mensagem no meio.
      await this.marcarComoLida(dados.supportChat.id);
      await this.marcarLidasNoWhatsapp(dados.supportChat);
    } catch (err) {
      this.logger.warn(`Não foi possível zerar as não lidas: ${err.message}`);
    }
  }

  async listAllSupportChats() {
    const conversas = await this.supportChatsRepository.findAllSupportChats();

    // A listagem carrega `user` e `contact`, e as colunas guardam a key. O
    // `<img>` da lista lateral aceita caminho relativo sem reclamar - só nao
    // mostra a foto -, entao a falha aqui era silenciosa.
    conversas?.forEach((conversa) => this.traduzAvatares(conversa));

    return conversas;
  }

  /**
   * A conversa pronta para o motor de chatbot enviar uma mensagem - mesma
   * releitura que a saudação automática usa (`contact`, `channel` completos).
   * Exposto aqui porque o repository não sai deste módulo; o motor de fluxo
   * (`chatbot-engine`) não deve depender de `SupportChatsRepository` direto.
   */
  async findParaEnvioBot(id: number): Promise<SupportChats | null> {
    return this.supportChatsRepository.findParaEstado(id);
  }

  async findSupportChatsById(id: number) {
    const supportChatMessages = await this.supportChatsRepository.findSupportChatsById(id);
    if (!supportChatMessages) {
      throw new NotFoundException('Chat de suporte não encontrado');
    }
    this.traduzAvatares(supportChatMessages);

    const comMidia = await this.messagesService.getUrlForMessageMedia(supportChatMessages);

    // Os eventos vêm junto das mensagens porque é com elas que são exibidos -
    // a transferência aparece intercalada na conversa, na ordem em que
    // aconteceu. Buscá-los à parte exigiria uma segunda chamada para desenhar
    // uma tela só.
    return {
      ...comMidia,
      supportChatEvents: await this.supportChatEventsRepository.findPorConversa(id),
    };
  }

  /**
   * Resumo do histórico do contato, para a conversa saber se há o que oferecer.
   *
   * Sem mensagens: é chamado ao abrir toda conversa, e o botão só aparece
   * quando `total > 0`.
   */
  async contarAnteriores(
    id: number,
    antes_de?: number,
  ): Promise<{ total: number; proximo: { id: number; protocol: string } | null }> {
    const { total, proximo } = await this.supportChatsRepository.contarAnteriores(id, antes_de);

    return {
      total,
      proximo: proximo ? { id: proximo.id, protocol: proximo.protocol } : null,
    };
  }

  /** O atendimento anterior ao `antes_de`, com as mensagens prontas para a tela. */
  async findAnterior(id: number, antes_de: number): Promise<SupportChats | null> {
    const anterior = await this.supportChatsRepository.findAnteriorComMensagens(id, antes_de);

    if (!anterior) return null;

    // As colunas guardam a key, não a URL - sem esta conversão o front recebe
    // `chat/media/xxx.jpeg` como se fosse endereço. Vale para a mídia das
    // mensagens e para os avatares de quem atendeu.
    this.traduzAvatares(anterior);

    return this.messagesService.getUrlForMessageMedia(anterior);
  }

  async sendReactionMessage(
    id: number,
    user_id: number,
    chat_id: string,
    messageId: string,
    reaction: string,
  ) {
    try {
      this.logger.log(
        `Enviando reação para ${chat_id} na mensagem ${messageId} com reação: ${reaction}`,
      );
      // `contact` vem junto: é necessário para marcar as lidas no WhatsApp.
      const supportChat = await this.carregaParaEscrita(id, user_id);

      // A Evolution identifica a mensagem reagida pela chave completa, e o
      // `fromMe` faz parte dela: reagir a uma mensagem nossa com `false` é
      // aceito pela API e simplesmente não aplica a reação.
      const mensagem = await this.messagesService.findByMessageId(messageId);

      await this.whatsappService.sendReaction(
        supportChat.channel.session_id,
        chat_id,
        messageId,
        reaction,
        mensagem?.from_me ?? false,
      );
    } catch (error) {
      this.logger.error('Falha ao enviar reação:', error.response?.data || error.message);
      throw new BadRequestException('Não foi possível enviar a reação.');
    }
  }

  /**
   * Revoga a mensagem no WhatsApp. A marcação local fica por conta do webhook
   * `messages.delete`, que é quem confirma que o WhatsApp aceitou a revogação.
   */
  /**
   * Altera o texto de uma mensagem já enviada.
   *
   * A marcação visual na conversa chega depois, pelo webhook `messages.edited`
   * - é ele que confirma que o WhatsApp aceitou a alteração.
   */
  async editMessage(id: number, user_id: number, messageId: string, texto: string) {
    const supportChat = await this.carregaParaEscrita(id, user_id);

    const message = await this.messagesService.findByMessageId(messageId);
    if (!message) {
      throw new NotFoundException('Mensagem não encontrada');
    }

    if (!message.from_me) {
      throw new BadRequestException('Só é possível editar mensagens enviadas por você');
    }

    if (message.is_deleted) {
      throw new BadRequestException('Esta mensagem foi apagada');
    }

    this.logger.log(`Editando mensagem ${messageId} de ${supportChat.contact?.remote_jid}`);

    await this.whatsappService.editMessage(
      supportChat.channel.session_id,
      supportChat.contact?.remote_jid,
      messageId,
      texto,
    );

    return { status: 'message edited' };
  }

  async deleteMessage(id: number, user_id: number, messageId: string) {
    const supportChat = await this.carregaParaEscrita(id, user_id);

    const message = await this.messagesService.findByMessageId(messageId);
    if (!message) {
      throw new NotFoundException('Mensagem não encontrada');
    }

    this.logger.log(`Apagando mensagem ${messageId} de ${supportChat.contact?.remote_jid}`);

    await this.whatsappService.deleteMessage(
      supportChat.channel.session_id,
      supportChat.contact?.remote_jid,
      messageId,
      message.from_me,
    );

    return { status: 'message deleted' };
  }

  /**
   * Oculta mensagens do portal, sem tocar no WhatsApp do contato.
   *
   * É o "apagar para mim": serve quando a janela de revogação (60h) já passou,
   * ou quando a mensagem é do contato - nos dois casos o WhatsApp não aceita
   * revogar, mas o atendente ainda quer limpar a conversa do lado de cá.
   *
   * A linha é preservada com `hidden_at` preenchido: o histórico de um
   * atendimento é registro de trabalho, e some da tela sem sumir do banco.
   */
  async ocultarMensagens(
    id: number,
    user_id: number,
    messageIds: string[],
  ): Promise<{ ocultadas: number }> {
    await this.carregaParaEscrita(id, user_id, []);

    if (!messageIds?.length) {
      throw new BadRequestException('Informe ao menos uma mensagem');
    }

    const ocultadas = await this.messagesService.ocultar(id, messageIds);

    this.logger.log(`Ocultadas ${ocultadas} mensagem(ns) do chat ${id}`);

    return { ocultadas };
  }

  async signMediaPost(signMediaPostDto: SignMediaPostDto): Promise<PresignedUpload> {
    try {
      let mediaName: string;

      mediaName = `${signMediaPostDto.key}/${randomUUID()}.${signMediaPostDto.fileType.split('/')[1]}`;

      const media_url = await this.storageService.createPresignedPost(
        mediaName,
        signMediaPostDto.fileType,
      );

      return media_url;
    } catch (err) {
      this.logger.error(err.message);
      throw err;
    }
  }

  // ====== Event Listeners Handles ======
  async onMessageCreate(payload: WhatsappWebhookPayload<MessagePayload>) {
    let chatbotParaEnfileirar: { executionId: number; trigger: 'start' | 'resume'; resumeText?: string } | null =
      null;

    const abertura = await runInTransaction(this.dataSource, async (manager) => {
      try {
        const { sessionId, data } = payload;
        const channel = await this.channelsRepository.findBySessionId(sessionId);
        const phoneContact = data.message.id.remote;

        // O `pushName` vem como texto único; o cadastro guarda separado.
        const { name, last_name } = separaNome(data?.message?._data?.notifyName || 'Cliente');

        const contact = await this.contactsService.findOrCreateByRemoteJid(
          { sessionId, remote_jid: phoneContact, name, last_name },
          manager,
        );

        const { supportChat, criada } = await this.supportChatsRepository.findOrOpenComSinal(
          contact.id,
          channel.id,
          manager,
        );

        const savedMessage = await this.messagesService.saveIncoming(
          channel,
          supportChat,
          data.message,
          manager,
        );

        // O bot só atua sobre mensagem real do cliente, e só enquanto a
        // conversa não foi assumida por um atendente - uma vez com dono
        // (`EM_ANDAMENTO`), o motor nunca é acionado, a não ser que o
        // atendente transfira de volta explicitamente (fora deste gancho).
        if (savedMessage && !savedMessage.from_me) {
          chatbotParaEnfileirar = await this.decideAcaoDoChatbot(
            contact.id,
            supportChat,
            channel,
            criada,
            savedMessage.content,
            manager,
          );
        }

        if (savedMessage) {
          // Só o que vem do cliente conta como não lido; o que nós enviamos já
          // nasce visto por quem enviou.
          if (!savedMessage.from_me) {
            const naoLidas = await this.supportChatsRepository.incrementaNaoLidas(
              supportChat.id,
              manager,
            );

            supportChat.unread_count = naoLidas;

            this.whatsappService.emitEvent('whatsapp:unread_count', {
              chatId: supportChat.id,
              unreadCount: naoLidas,
            });
          }

          // `lastMessage` só vem preenchido quando a mensagem afetada era a
          // última da conversa; nas demais, a prévia do chat não muda.
          if (savedMessage.lastMessage) {
            await this.supportChatsRepository.updateLastMessage(
              supportChat.id,
              savedMessage.lastMessage,
              manager,
            );
            await this.whatsappChatStateEmit(
              {
                ...supportChat,
                last_message: savedMessage.lastMessage.content,
                last_message_type: savedMessage.lastMessage.type,
                last_message_id: savedMessage.lastMessage.id,
              },
              manager,
            );
          }

          const supoportChatsWhitMessage = {
            ...supportChat,
            // A key vira URL pública aqui: o que sai pelo socket é o que o
            // front renderiza direto, sem passar pela leitura HTTP.
            supportChatMessages: this.messagesService.comUrlPublica(savedMessage),
          };

          this.whatsappService.emitEvent('whatsapp:messages', supoportChatsWhitMessage);
        }

        // A saudação sai fora desta transação - ver abaixo. Só mensagem do
        // cliente a dispara: a sincronizada do celular do atendente também
        // passa por aqui e abriria conversa, mas responder a nós mesmos não
        // faz sentido.
        return criada && savedMessage && !savedMessage.from_me ? supportChat.id : null;
      } catch (err) {
        this.logger.error(`Erro ao processar mensagem: ${err.message}`);
        throw err;
      }
    });

    // ⚠️ **Depois do commit, de propósito.** Uma chamada HTTP ao provider
    // dentro da transação prenderia a conexão do banco pelo tempo da rede, e a
    // fila de mensagens roda com `concurrency: 1` - seria a conversa inteira
    // esperando. Aqui a mensagem do cliente já está gravada; a saudação é o
    // extra.
    if (abertura) {
      // Releitura para trazer `contact.client` e `channel`, que as variáveis
      // usam e que o `findOrOpenComSinal` não carrega por completo.
      const conversa = await this.supportChatsRepository.findParaEstado(abertura);

      // O chatbot de entrada substitui a saudação do canal - decisão do
      // usuário, para não disparar as duas mensagens de abertura. Sem
      // chatbot, o texto ainda pode ser trocado pela mensagem de ausência de
      // um setor fora do horário (ver `decideMensagemDeAbertura`).
      if (!chatbotParaEnfileirar) {
        const texto = await this.decideMensagemDeAbertura(conversa.channel);
        await this.enviaMensagemAutomatica(conversa, texto);
      }

      await this.enviaAvisosAtivos(conversa);
    }

    if (chatbotParaEnfileirar) {
      await this.chatbotFlowExecutionsService.enfileirar(
        chatbotParaEnfileirar.executionId,
        chatbotParaEnfileirar.trigger === 'resume'
          ? { kind: 'resume', resumePayload: { text: chatbotParaEnfileirar.resumeText } }
          : { kind: 'start' },
      );
    }
  }

  /**
   * Decide, dentro da transação de `onMessageCreate`, se um chatbot deve
   * agir sobre esta mensagem - e já cria/atualiza o estado necessário. O
   * enfileiramento do job em si fica para depois do commit (ver acima).
   */
  private async decideAcaoDoChatbot(
    contactId: number,
    supportChat: SupportChats,
    channel: Channels,
    conversaCriada: boolean,
    textoRecebido: string,
    manager: EntityManager,
  ): Promise<{ executionId: number; trigger: 'start' | 'resume'; resumeText?: string } | null> {
    const execucaoSuspensa = await this.chatbotFlowExecutionsRepository.findSuspendedAwaitingReply(
      contactId,
      manager,
    );

    if (execucaoSuspensa) {
      return { executionId: execucaoSuspensa.id, trigger: 'resume', resumeText: textoRecebido };
    }

    // Só conversa nova entra por um chatbot de entrada - uma conversa já
    // aberta e sem execução pendente segue o caminho normal (atendimento
    // humano), mesmo que ainda esteja `AGUARDANDO`.
    if (!conversaCriada) return null;

    const chatbotEntrada = await this.chatbotsRepository.findEntradaAtivoDoCanal(channel.id, manager);
    if (!chatbotEntrada?.current_published_version_id) return null;

    const execucao = await this.chatbotFlowExecutionsService.iniciar(
      contactId,
      supportChat.id,
      chatbotEntrada,
      manager,
    );

    // A "fila do bot": a conversa some de Aguardando/Em fila humana enquanto
    // o motor está processando, e volta a aparecer se ele redirecionar.
    await this.supportChatsRepository.atualizaStatus(
      supportChat.id,
      SupportChatStatusId.EM_FILA,
      manager,
    );

    return { executionId: execucao.id, trigger: 'start' };
  }

  async onMessageAck(payload: WhatsappWebhookPayload<MessagePayload>) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const { data } = payload;

        // A mensagem é localizada pelo próprio id, sem passar pelo contato: o
        // ack chega com `remoteJid` no formato `@lid`, que não corresponde ao
        // `remote_jid` gravado. Mensagem desconhecida (sincronização inicial da
        // sessão, por exemplo) simplesmente não tem o que atualizar.
        const savedMessage = await this.messagesService.saveMessageAck(data.message, manager);

        if (savedMessage) {
          // O front substitui a mensagem inteira ao receber o ack, então a
          // key precisa virar URL aqui também - senão o ack apagaria a imagem
          // que o evento anterior já tinha exibido.
          this.whatsappService.emitEvent(
            'whatsapp:message_ack',
            this.messagesService.comUrlPublica(savedMessage),
          );
        }
      } catch (err) {
        this.logger.error(`Erro ao processar mensagem ack: ${err.message}`);
        throw err;
      }
    });
  }

  async onMessageEdit(payload: WhatsappWebhookPayload<MessageEditPayload>) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const { sessionId, data } = payload;
        const channel = await this.channelsRepository.findBySessionId(sessionId);
        const phoneContact = data.message.id.remote;
        const contact = await manager.findOneBy(Contacts, {
          remote_jid: phoneContact,
        });

        // Edição de mensagem de uma conversa desconhecida: nada a atualizar.
        if (!contact) {
          this.logger.debug(`Edição ignorada: contato ${phoneContact} não cadastrado.`);
          return;
        }

        const supportChat = await this.findOrOpen(contact.id, channel.id, manager);

        const savedMessage = await this.messagesService.saveMessageEdited(
          supportChat,
          data.message,
          manager,
        );

        if (savedMessage) {
          await this.supportChatsRepository.updateLastMessage(
            supportChat.id,
            savedMessage?.lastMessage,
            manager,
          );
          await this.whatsappChatStateEmit(
            {
              ...supportChat,
              last_message: savedMessage?.lastMessage?.content,
              last_message_type: savedMessage?.lastMessage?.type,
              last_message_id: savedMessage?.lastMessage?.id,
            },
            manager,
          );

          const supoportChatsWhitMessage = {
            ...supportChat,
            // A key vira URL pública aqui: o que sai pelo socket é o que o
            // front renderiza direto, sem passar pela leitura HTTP.
            supportChatMessages: this.messagesService.comUrlPublica(savedMessage),
          };

          this.whatsappService.emitEvent('whatsapp:messages', supoportChatsWhitMessage);
        }
      } catch (err) {
        this.logger.error(`Erro ao processar mensagem edit: ${err.message}`);
        throw err;
      }
    });
  }

  async onMessageRevokeEveryone(payload: WhatsappWebhookPayload<MessageEditPayload>) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const { data } = payload;
        const messageId = data.message.protocolMessageKey.id;

        // A conversa vem da própria mensagem, não do JID: a revogação feita no
        // aparelho chega com `remoteJid` em formato `@lid`, que não bate com o
        // `remote_jid` do contato.
        const mensagem = await this.messagesService.findByMessageId(messageId);
        if (!mensagem) {
          this.logger.debug(`Revogação ignorada: mensagem ${messageId} não encontrada.`);
          return;
        }

        const supportChat = await this.supportChatsRepository.findOne({
          where: { id: mensagem.support_chat_id },
        });
        if (!supportChat) {
          this.logger.debug(`Revogação ignorada: chat ${mensagem.support_chat_id} não encontrado.`);
          return;
        }

        const savedMessage = await this.messagesService.saveMessageRevokeEveryone(
          supportChat,
          data.message,
          manager,
        );

        if (savedMessage) {
          // `lastMessage` só vem preenchido quando a mensagem afetada era a
          // última da conversa; nas demais, a prévia do chat não muda.
          if (savedMessage.lastMessage) {
            await this.supportChatsRepository.updateLastMessage(
              supportChat.id,
              savedMessage.lastMessage,
              manager,
            );
            await this.whatsappChatStateEmit(
              {
                ...supportChat,
                last_message: savedMessage.lastMessage.content,
                last_message_type: savedMessage.lastMessage.type,
                last_message_id: savedMessage.lastMessage.id,
              },
              manager,
            );
          }

          const supoportChatsWhitMessage = {
            ...supportChat,
            // A key vira URL pública aqui: o que sai pelo socket é o que o
            // front renderiza direto, sem passar pela leitura HTTP.
            supportChatMessages: this.messagesService.comUrlPublica(savedMessage),
          };

          this.whatsappService.emitEvent('whatsapp:messages', supoportChatsWhitMessage);
        }
      } catch (err) {
        this.logger.error(`Erro ao processar mensagem: ${err.message}`);
        throw err;
      }
    });
  }

  async onMessageReaction(payload: WhatsappWebhookPayload<ReactionPayload>) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const { data } = payload;

        // A mensagem reagida é localizada pelo `message_id`, que é único, e não
        // pelo JID do contato: a Evolution entrega este evento ora em
        // `@s.whatsapp.net`, ora em `@lid` - e o segundo não bate com o que
        // está gravado, fazendo a reação ser descartada em silêncio.
        const mensagemReagida = await this.messagesService.findByMessageId(data.reaction.msgId.id);

        if (!mensagemReagida) {
          this.logger.debug(
            `Reação ignorada: mensagem ${data.reaction.msgId.id} não está no histórico.`,
          );
          return;
        }

        const supportChat = await this.supportChatsRepository.findOne({
          where: { id: mensagemReagida.support_chat_id },
          relations: ['contact', 'channel'],
        });

        if (!supportChat) {
          this.logger.debug(`Reação ignorada: conversa ${mensagemReagida.support_chat_id} sumiu.`);
          return;
        }

        const savedMessage = await this.messagesService.saveMessageReaction(
          supportChat.id,
          data.reaction,
          manager,
        );

        if (savedMessage) {
          const supoportChatsWhitMessage = {
            ...supportChat,
            // A key vira URL pública aqui: o que sai pelo socket é o que o
            // front renderiza direto, sem passar pela leitura HTTP.
            supportChatMessages: this.messagesService.comUrlPublica(savedMessage),
          };
          this.whatsappService.emitEvent('whatsapp:messages', supoportChatsWhitMessage);
        }

      } catch (err) {
        this.logger.error(`Erro ao processar mensagem: ${err.message}`);
        throw err;
      }
    });
  }

  /**
   * Marca a conversa como lida - acionado quando o atendente a abre no painel.
   *
   * É o único caminho que zera a contagem. O `chats.update` da Evolution não
   * serve: chega identificado por `@lid` (que não é o `remote_jid` gravado) e
   * sem o `unreadCount`, trazendo apenas `remoteJid` e `instanceId`.
   */
  /**
   * Marca no WhatsApp as mensagens que o contato enviou - o tique azul dele.
   *
   * Acontece quando o atendente responde, não quando abre a conversa: abrir e
   * sair sem responder não é atendimento, e o "visto" cria no contato a
   * expectativa de que alguém está ali.
   */
  private async marcarLidasNoWhatsapp(supportChat: SupportChats): Promise<void> {
    const pendentes = await this.messagesService.buscaNaoLidasParaMarcar(supportChat.id);
    if (!pendentes.length) return;

    const chatId = supportChat.contact?.remote_jid;
    if (!chatId) return;

    await this.whatsappService.markAsRead(
      supportChat.channel.session_id,
      pendentes.map((m) => ({ messageId: m.message_id, chatId, fromMe: false })),
    );
  }

  async marcarComoLida(id: number): Promise<void> {
    await this.supportChatsRepository.zeraNaoLidas(id);

    this.whatsappService.emitEvent('whatsapp:unread_count', {
      chatId: id,
      unreadCount: 0,
    });
  }

  async findOrOpen(
    contact_id: number,
    channel_id: number,
    manager: EntityManager,
    user_id?: number,
  ) {
    return await this.supportChatsRepository.findOrOpen(contact_id, channel_id, manager, user_id);
  }

  /**
   * Cria uma conversa do zero, sem esperar uma mensagem chegar pelo webhook -
   * o atendente escolhe quem vai atender (contato existente ou número novo)
   * e por qual canal, e já nasce dono dela (`EM_ANDAMENTO`), pronta para
   * escrever a primeira mensagem manualmente.
   *
   * Diferente do cadastro manual de contato (`ContactsService.createContact`):
   * aqui um número sem WhatsApp confirmado **bloqueia** a criação, em vez de
   * salvar com `remote_jid` nulo e um aviso - uma conversa sem JID válido
   * nunca conseguiria enviar mensagem de verdade.
   */
  async criarNova(dto: CreateSupportChatDto, user_id: number): Promise<SupportChats> {
    if (Boolean(dto.contact_id) === Boolean(dto.phone)) {
      throw new BadRequestException('Informe um contato existente ou um número novo, não os dois');
    }

    const channel = await this.channelsRepository.findByIdConectado(dto.channel_id);

    const { supportChat, criada } = await runInTransaction(this.dataSource, async (manager) => {
      const contactId = dto.contact_id
        ? await this.resolveContatoExistente(dto.contact_id)
        : await this.resolveContatoNovo(dto.phone, dto.name, manager);

      const resultado = await this.supportChatsRepository.findOrOpenComSinal(
        contactId,
        channel.id,
        manager,
        user_id,
      );

      // Só promove a dono quem de fato criou agora - uma conversa que já
      // existia (idempotência do `findOrOpenComSinal`) mantém o dono atual,
      // mesma regra de conflito que `iniciarAtendimento` já aplica.
      if (resultado.criada) {
        await this.supportChatsRepository.assumir(resultado.supportChat.id, user_id, new Date(), manager);
      }

      return resultado;
    });

    this.logger.log(
      `Conversa ${criada ? 'criada' : 'reaberta'}: id ${supportChat.id}, canal ${channel.id}`,
    );

    return this.recarregaEEmiteEstado(supportChat.id);
  }

  /** Contato já cadastrado - precisa ter JID confirmado, senão a conversa não teria como enviar mensagem. */
  private async resolveContatoExistente(contactId: number): Promise<number> {
    const contact = await this.contactsRepository.findById(contactId);

    if (!contact.remote_jid) {
      throw new BadRequestException('Este contato não tem número de WhatsApp confirmado');
    }

    return contact.id;
  }

  /**
   * Número novo - mesmo caminho de verificação que `ContactsService.createContact`
   * usa (`comDdiBrasil` + `whatsappService.verificaNumero`), mas bloqueando
   * em vez de salvar com aviso quando o número não é confirmado.
   */
  private async resolveContatoNovo(
    phone: string,
    name: string | undefined,
    manager: EntityManager,
  ): Promise<number> {
    if (!name?.trim()) {
      throw new BadRequestException('Informe o nome do contato');
    }

    const numero = comDdiBrasil(phone);
    if (!numero) {
      throw new BadRequestException('Informe um número de telefone válido');
    }

    const verificado = await this.whatsappService.verificaNumero(numero);

    if (!verificado) {
      throw new BadRequestException('Não foi possível verificar o número agora. Tente novamente.');
    }
    if (!verificado.existe || !verificado.remoteJid) {
      throw new BadRequestException('Este número não tem WhatsApp');
    }

    const existente = await manager.findOneBy(Contacts, { remote_jid: verificado.remoteJid });
    if (existente) {
      throw new ConflictException(
        `Este número já está cadastrado no contato "${nomeCompleto(existente)}"`,
      );
    }

    const novoContato = await manager.save(
      Contacts,
      manager.create(Contacts, {
        name: name.trim(),
        phone: verificado.remoteJid.split('@')[0],
        remote_jid: verificado.remoteJid,
        status: 1,
      }),
    );

    return novoContato.id;
  }

  /**
   * Atribui o atendimento ao atendente e inicia a contagem de tempo.
   *
   * A conversa nasce em "Aguardando" e só sai daqui: enquanto ninguém assume,
   * o cronômetro não corre e não há a quem cobrar o atendimento.
   */
  async iniciarAtendimento(id: number, user_id: number): Promise<SupportChats> {
    const supportChat = await this.supportChatsRepository.findParaEstado(id);
    if (!supportChat) {
      throw new NotFoundException('Chat de suporte não encontrado');
    }

    if (supportChat.supportChatStatus?.is_final) {
      throw new BadRequestException('Este atendimento já foi finalizado');
    }

    if (supportChat.support_chat_status_id === SupportChatStatusId.EM_ANDAMENTO) {
      // Idempotente para quem já é o dono: duplo clique não é erro.
      if (Number(supportChat.user_id) === Number(user_id)) {
        return supportChat;
      }
      throw new ConflictException(
        `Atendimento já assumido por ${nomeCompleto(supportChat.user) || 'outro atendente'}`,
      );
    }

    const assumidoEm = new Date();
    const afetadas = await runInTransaction(this.dataSource, (manager) =>
      this.supportChatsRepository.assumir(id, user_id, assumidoEm, manager),
    );

    // Zero linhas significa que outro atendente ganhou a corrida entre a
    // leitura acima e o update.
    if (!afetadas) {
      throw new ConflictException('Este atendimento acabou de ser assumido por outro atendente');
    }

    return this.recarregaEEmiteEstado(id);
  }

  /**
   * Encerra o atendimento.
   *
   * Exige cliente associado: o atendimento encerrado alimenta o histórico do
   * cliente, e sem o vínculo ele se perde. A mesma regra existe no front, que
   * bloqueia o botão - aqui é a garantia de quem chama a API direto.
   */
  async finalizarAtendimento(
    id: number,
    user_id: number,
    dto: FinalizarAtendimentoDto,
  ): Promise<SupportChats> {
    const supportChat = await this.supportChatsRepository.findParaEstado(id);
    if (!supportChat) {
      throw new NotFoundException('Chat de suporte não encontrado');
    }

    if (supportChat.supportChatStatus?.is_final) {
      throw new BadRequestException('Este atendimento já foi finalizado');
    }

    if (supportChat.support_chat_status_id !== SupportChatStatusId.EM_ANDAMENTO) {
      throw new BadRequestException('Inicie o atendimento antes de finalizá-lo');
    }

    if (Number(supportChat.user_id) !== Number(user_id)) {
      throw new ForbiddenException('Somente quem assumiu o atendimento pode finalizá-lo');
    }

    if (!supportChat.contact?.client_id) {
      throw new BadRequestException(
        'Associe o contato a um cliente antes de finalizar o atendimento',
      );
    }

    // ⚠️ **Antes de finalizar, e isto não é preferência.** Enviada depois, a
    // despedida volta pelo webhook para uma conversa já `is_final`, e o
    // `findOrOpen` - que filtra por `is_final = false` - não a encontra e abre
    // **uma conversa nova**, com protocolo novo, em Aguardando. O pior caso
    // desta ordem é despedida enviada com a finalização falhando logo em
    // seguida; o da outra é um protocolo fantasma a cada atendimento
    // encerrado.
    //
    // `sem_despedida` pula o envio: há conversa que termina com o cliente já
    // resolvido e despedido, e repetir o texto padrão soa automático.
    if (!dto.sem_despedida) {
      await this.enviaMensagemAutomatica(supportChat, supportChat.channel?.mensagem_despedida);
    }

    const afetadas = await runInTransaction(this.dataSource, (manager) =>
      this.supportChatsRepository.finalizar(
        id,
        new Date(),
        dto.observation_user?.trim() || null,
        manager,
      ),
    );

    if (!afetadas) {
      throw new ConflictException('O atendimento mudou de estado durante a finalização');
    }

    return this.recarregaEEmiteEstado(id);
  }

  /**
   * Encerra uma conversa que não será atendida.
   *
   * O caso: mensagem de marketing chegando no número, ou contato que não
   * receberá atendimento. Encerra direto de **Aguardando**, sem passar por
   * "iniciar".
   *
   * Três diferenças em relação ao `finalizarAtendimento`, e todas são o ponto:
   * - **não exige cliente associado** - descartar spam não pode dar mais
   *   trabalho do que atender;
   * - **não exige dono** - ninguém assumiu, e exigir que assumisse primeiro
   *   seria burocracia;
   * - **não envia despedida** - não houve atendimento do qual se despedir, e o
   *   texto confirmaria ao remetente que o número existe e é lido.
   *
   * Grava o status 4 (`FINALIZADO_SEM_RESPOSTA`), distinto do encerramento
   * normal para os relatórios.
   */
  async finalizarSemAtendimento(
    id: number,
    user_id: number,
    dto: FinalizarSemAtendimentoDto,
  ): Promise<SupportChats> {
    const supportChat = await this.supportChatsRepository.findParaEstado(id);
    if (!supportChat) {
      throw new NotFoundException('Chat de suporte não encontrado');
    }

    if (supportChat.supportChatStatus?.is_final) {
      throw new BadRequestException('Este atendimento já foi finalizado');
    }

    if (supportChat.support_chat_status_id === SupportChatStatusId.EM_ANDAMENTO) {
      throw new BadRequestException(
        'Este atendimento já foi iniciado; use a finalização normal',
      );
    }

    const afetadas = await runInTransaction(this.dataSource, (manager) =>
      this.supportChatsRepository.finalizarSemAtendimento(
        id,
        new Date(),
        dto.observation_user?.trim() || null,
        manager,
      ),
    );

    // `affected = 0` aqui significa que outro atendente assumiu a conversa
    // entre a leitura e o UPDATE - o banco arbitra, como no `iniciar`.
    if (!afetadas) {
      throw new ConflictException('O atendimento mudou de estado; recarregue a conversa');
    }

    this.logger.log(`Conversa ${id} encerrada sem atendimento por user ${user_id}`);

    return this.recarregaEEmiteEstado(id);
  }

  /**
   * Devolve a conversa à lista como não lida.
   *
   * O inverso do `marcarComoLida`, para o gesto de "vou olhar isto depois": o
   * badge volta a aparecer na lista lateral.
   *
   * ⚠️ Não mexe no WhatsApp. O tique azul já foi enviado quando o atendente
   * respondeu, e não há como desfazê-lo - isto é sinalização interna.
   */
  async marcarComoNaoLida(id: number): Promise<SupportChats> {
    const supportChat = await this.supportChatsRepository.findParaEstado(id);
    if (!supportChat) {
      throw new NotFoundException('Chat de suporte não encontrado');
    }

    await runInTransaction(this.dataSource, (manager) =>
      this.supportChatsRepository.marcarComoNaoLida(id, manager),
    );

    return this.recarregaEEmiteEstado(id);
  }

  /**
   * Passa o atendimento para outro atendente, ou devolve para a espera.
   *
   * São dois caminhos da mesma ação: com `user_destino_id` a conversa troca de
   * dono e segue em andamento; sem ele, perde o dono e volta para "Aguardando",
   * de onde qualquer um a assume.
   *
   * Só o dono transfere - mesma regra de `finalizarAtendimento`, e pelo mesmo
   * motivo: a conversa é responsabilidade de quem a assumiu, e tirá-la dele sem
   * que ele saiba é o tipo de coisa que se descobre tarde demais.
   *
   * ⚠️ Transferir passa junto o **direito de finalizar**: `finalizarAtendimento`
   * valida o dono, e depois daqui ele é outro.
   */
  async transferirAtendimento(
    id: number,
    user_id: number,
    dto: TransferirAtendimentoDto,
  ): Promise<SupportChats> {
    const supportChat = await this.supportChatsRepository.findParaEstado(id);
    if (!supportChat) {
      throw new NotFoundException('Chat de suporte não encontrado');
    }

    if (supportChat.supportChatStatus?.is_final) {
      throw new BadRequestException('Este atendimento já foi finalizado');
    }

    if (supportChat.support_chat_status_id !== SupportChatStatusId.EM_ANDAMENTO) {
      throw new BadRequestException('Inicie o atendimento antes de transferi-lo');
    }

    if (Number(supportChat.user_id) !== Number(user_id)) {
      throw new ForbiddenException('Somente quem assumiu o atendimento pode transferi-lo');
    }

    const destinoId = dto.user_destino_id ?? null;

    if (destinoId !== null) {
      if (Number(destinoId) === Number(user_id)) {
        throw new BadRequestException('O atendimento já é seu');
      }
      // Lança `BadRequestException` se não existir ou estiver inativo - não
      // dá para entregar uma conversa a quem não pode atendê-la.
      await this.userRepository.findById(destinoId);
    }

    const motivo = dto.motivo?.trim() || null;

    const afetadas = await runInTransaction(this.dataSource, async (manager) => {
      const linhas = await this.supportChatsRepository.transferir(
        id,
        user_id,
        destinoId,
        manager,
      );

      // Só registra o evento se a troca de dono valeu: senão a conversa teria
      // no histórico uma transferência que não chegou a acontecer.
      if (linhas) {
        await this.supportChatEventsRepository.registraTransferencia(
          id,
          user_id,
          destinoId,
          motivo,
          manager,
        );
      }

      return linhas;
    });

    if (!afetadas) {
      throw new ConflictException('O atendimento mudou de estado durante a transferência');
    }

    this.logger.log(
      `Atendimento ${id} transferido por ${user_id} para ${destinoId ?? 'a fila de espera'}`,
    );

    return this.recarregaEEmiteEstado(id);
  }

  /** Eventos do atendimento, para a conversa mostrar o que aconteceu nela. */
  async listaEventos(id: number): Promise<SupportChatEvents[]> {
    return this.supportChatEventsRepository.findPorConversa(id);
  }

  /**
   * Recarrega a conversa no formato canônico e avisa os clientes conectados.
   *
   * Os handlers de webhook emitem `chat_state` com o objeto que já tinham em
   * mãos, cujo shape varia; aqui sempre sai completo, para o front poder
   * mesclar sem perder o que já havia carregado.
   */
  /**
   * Troca as keys de avatar pela URL pública, no lugar.
   *
   * As colunas guardam a key do storage, não a URL. Sem esta tradução o
   * `next/image` do front recebe `user/avatar/xxx.jpeg` e quebra a tela
   * inteira, porque exige caminho absoluto ou barra inicial.
   *
   * `getPublicUrl` é idempotente, então chamar duas vezes no mesmo objeto não
   * faz mal - o que evita ter de rastrear por onde a conversa já passou.
   */
  private traduzAvatares(chat: SupportChats | null): SupportChats | null {
    if (!chat) return chat;

    if (chat.user?.avatar_url) {
      chat.user.avatar_url = this.storageService.getPublicUrl(chat.user.avatar_url);
    }

    // O avatar externo é a URL que o WhatsApp devolve, e não passa pelo nosso
    // storage: convertê-la produziria um caminho para um objeto que não existe.
    if (chat.contact?.avatar_url && !chat.contact.is_avatar_external) {
      chat.contact.avatar_url = this.storageService.getPublicUrl(chat.contact.avatar_url);
    }

    return chat;
  }

  private async recarregaEEmiteEstado(id: number): Promise<SupportChats> {
    const atualizado = await this.supportChatsRepository.findParaEstado(id);
    await this.whatsappChatStateEmit(atualizado);

    // A tradução precisa acontecer aqui tambem, e nao so no emit: aquele
    // metodo faz releitura propria e muta *o objeto dele*, outra instancia.
    // Sem isto a resposta HTTP de iniciar/finalizar saía com a key crua,
    // enquanto o socket recebia a URL boa.
    return this.traduzAvatares(atualizado) ?? atualizado;
  }

  /**
   * Emite o estado da conversa para os clientes conectados.
   *
   * Recarrega antes de emitir: os chamadores passam o objeto que tinham em
   * mãos, vindo de `findOrOpen`, que não traz `contact.client` nem o
   * `unread_count` já incrementado. O front faz merge do que chega, então um
   * payload incompleto apagava o nome do cliente e zerava o contador na tela.
   *
   * Os campos de prévia (`last_message*`) vêm de quem chama, porque são
   * calculados a partir da mensagem que acabou de ser salva.
   */
  async whatsappChatStateEmit(supportChat: SupportChats, manager?: EntityManager) {
    const completo = await this.supportChatsRepository.findParaEstado(supportChat.id, manager);

    // Senão o socket sobrescreve na tela a URL boa por um caminho relativo
    // que o navegador não resolve.
    this.traduzAvatares(completo);

    this.whatsappService.emitEvent('whatsapp:chat_state', {
      ...(completo ?? supportChat),
      // Estes quatro vêm de quem chama, não da releitura: a prévia é calculada
      // da mensagem recém-salva e o contador acabou de ser incrementado, ambos
      // em memória. Quando o `manager` é passado a releitura já enxerga a
      // transação, mas mantê-los custa nada e cobre o chamador que não passa.
      last_message: supportChat.last_message,
      last_message_type: supportChat.last_message_type,
      last_message_id: supportChat.last_message_id,
      unread_count: supportChat.unread_count ?? completo?.unread_count ?? 0,
      // O `updated_at` do banco ainda é o anterior ao commit desta transação, e
      // é por ele que a lista se ordena - sem isto a conversa com mensagem nova
      // não sobe para o topo.
      updated_at: new Date(),
    });

  }
}
