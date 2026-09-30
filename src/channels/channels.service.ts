import { runInTransaction } from '@/Utils';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChannelStatus, WhatsappWebhookPayload } from '@types';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { DataSource, EntityManager } from 'typeorm';
import { WhatsappService } from 'whatsapp/whatsapp.service';
import { DepartmentsRepository } from '@/departments/departments.repository';
import { PresignedUpload, StorageService } from '@/storage/storage.service';
import { ChannelsRepository } from './channels.repository';
import { AssinarAnexoCanalDto } from './dto/assinar-anexo-canal.dto';
import { CreateOrChannelDto } from './dto/create-or-channel.dto';
import { Channels } from './entities/channels.entity';

/** Onde os anexos de saudação/despedida vivem. O cron de retenção não varre este prefixo. */
const PREFIXO_ANEXO = 'channels';

@Injectable()
export class ChannelsService {
  private readonly logger = new Logger(ChannelsService.name);
  constructor(
    private readonly channelsRepository: ChannelsRepository,
    private readonly whatsappService: WhatsappService,
    private readonly departmentsRepository: DepartmentsRepository,
    private readonly storageService: StorageService,
    private dataSource: DataSource,
  ) {}

  async getActiveChannels(): Promise<Channels[]> {
    const channels = await this.channelsRepository.findActives();
    return channels;
  }

  async getChannelBySessionId(sessionId: string): Promise<Channels> {
    const channel = await this.channelsRepository.findBySessionId(sessionId);
    return channel;
  }

  /**
   * O `class-validator` não compara dois campos do mesmo DTO sem um
   * validador customizado (sem precedente no projeto) - mais simples validar
   * aqui, onde o resto da regra de negócio da inatividade já é decidido.
   */
  private validaInatividade(dto: CreateOrChannelDto): void {
    if (
      dto.inatividade_ativa &&
      dto.inatividade_avisar_em_minutos != null &&
      dto.inatividade_resolver_em_minutos != null &&
      dto.inatividade_avisar_em_minutos >= dto.inatividade_resolver_em_minutos
    ) {
      throw new BadRequestException(
        'O tempo para avisar deve ser menor que o tempo para resolver',
      );
    }

    // Sem a mensagem, o cliente é surpreendido pelo encerramento sem
    // nenhum aviso prévio - mesma regra já checada no front, reforçada aqui
    // para quem chama a API direto.
    if (dto.inatividade_ativa && !dto.inatividade_mensagem_aviso?.trim()) {
      throw new BadRequestException(
        'Informe a mensagem de aviso para ativar a resolução automática',
      );
    }
  }

  async createChannel(createChannelDto: CreateOrChannelDto): Promise<Channels> {
    this.validaInatividade(createChannelDto);
    const { department_ids, ...dadosDoCanal } = createChannelDto;

    const channel = this.channelsRepository.create({
      ...dadosDoCanal,
    });

    await this.channelsRepository.save(channel);

    if (department_ids !== undefined) {
      await runInTransaction(this.dataSource, (manager) =>
        this.gravaSetores(channel.id, department_ids, manager),
      );
    }

    return channel;
  }

  async updateChannel(channelId: number, createChannelDto: CreateOrChannelDto): Promise<Channels> {
    this.validaInatividade(createChannelDto);
    const channel = await this.findChannel(channelId);
    const { department_ids, ...dadosDoCanal } = createChannelDto;

    // O anexo antigo sai do storage quando é trocado ou removido: sem isto o
    // bucket acumularia arquivos que nada mais referencia.
    await this.removeAnexoTrocado(channel.saudacao_anexo_key, dadosDoCanal.saudacao_anexo_key);
    await this.removeAnexoTrocado(channel.despedida_anexo_key, dadosDoCanal.despedida_anexo_key);

    const channelUpdated = this.channelsRepository.create({
      ...channel,
      ...dadosDoCanal,
    });
    await this.channelsRepository.save(channelUpdated);

    // Só com o campo presente: o formulário sempre o envia hoje, mas outros
    // caminhos de escrita (integração, por exemplo) não precisam derrubar os
    // vínculos por omissão.
    if (department_ids !== undefined) {
      await runInTransaction(this.dataSource, (manager) =>
        this.gravaSetores(channelId, department_ids, manager),
      );
    }

    return channel;
  }

  /**
   * Substitui os setores do canal pelos informados.
   *
   * Apaga e regrava, como o mesmo caso em `UsersService`: são poucas linhas
   * por canal, e o resultado é igual ao de calcular a diferença. Ids de setor
   * removido são ignorados - a tela pode ter carregado a lista antes de
   * alguém remover um deles.
   */
  private async gravaSetores(
    channelId: number,
    department_ids: number[],
    manager: EntityManager,
  ): Promise<void> {
    const setores = await this.departmentsRepository.findByIds(department_ids, manager);

    await manager.query('DELETE FROM channel_x_department WHERE channel_id = $1', [channelId]);

    for (const setor of setores) {
      await manager.query(
        'INSERT INTO channel_x_department (channel_id, department_id) VALUES ($1, $2)',
        [channelId, setor.id],
      );
    }
  }

  async removeChannel(channelId: number): Promise<void> {
    const channel = await this.findChannel(channelId);
    const channelRemoved = this.channelsRepository.create({
      ...channel,
      channel_status_id: ChannelStatus.DELETED,
      deleted_at: new Date(),
    });
    await this.channelsRepository.save(channelRemoved);
  }

  /**
   * O canal com as relações que a tela precisa.
   *
   * Antes era `findOneBy`, que traz só as colunas: o `GET /channels/:id`
   * devolvia `channelStatus` indefinido, e a tela de canais, ao abrir o modal,
   * substituía o canal da listagem por essa versão incompleta. O aviso de
   * sincronização passava a dizer que o status anterior era "desconhecido",
   * mesmo estando na tela um instante antes.
   */
  async findChannel(channelId: number): Promise<Channels> {
    const channel = await this.channelsRepository.findOne({
      where: { id: channelId },
      relations: ['channelStatus'],
    });
    if (!channel) {
      this.logger.error(`Erro ao localizar canal: Canal não encontrado com este id`);
      throw new NotFoundException('Canal não encontrado com este id');
    }
    return channel;
  }

  /**
   * O canal com os setores, para o formulário de edição pré-carregar o campo.
   *
   * Separado de `findChannel`: aquele é usado por oito outras rotas (iniciar
   * sessão, encerrar, reiniciar…), e o join de setores custaria em todas para
   * servir só a uma tela.
   */
  async findChannelComSetores(channelId: number): Promise<Channels> {
    const channel = await this.findChannel(channelId);

    channel.departments = await this.dataSource
      .createQueryBuilder()
      .relation(Channels, 'departments')
      .of(channelId)
      .loadMany();

    return this.comUrlDosAnexos(channel);
  }

  /**
   * URL assinada para subir o anexo da saudação ou da despedida.
   *
   * ⚠️ O prefixo é fixo aqui, não vem do corpo: o `sign-media-post` do chat
   * aceita o caminho de quem chama, o que deixa qualquer autenticado escrever
   * onde quiser no bucket.
   *
   * A extensão sai do **nome original** - derivá-la do mimetype produz
   * `.vnd.openxmlformats-officedocument.wordprocessingml.document` num
   * `.docx`, e aqui o arquivo fica com esse nome para sempre.
   */
  async assinarAnexo(dto: AssinarAnexoCanalDto): Promise<PresignedUpload> {
    const extensao = extname(dto.fileName) || '';
    const key = `${PREFIXO_ANEXO}/${randomUUID()}${extensao}`;

    return this.storageService.createPresignedPost(key, dto.fileType);
  }

  /**
   * Uma cópia descartável do anexo da saudação, para ser enviada como mídia.
   *
   * ⚠️ **É isto que protege o cadastro.** A mensagem enviada guarda a key da
   * mídia, e o cron de retenção apaga por essa key depois de alguns meses, sem
   * olhar prefixo. Se a mensagem apontasse para o arquivo do cadastro, o
   * primeiro envio o condenaria - e a saudação de todo mundo quebraria de uma
   * vez, em silêncio.
   */
  async copiaAnexoSaudacaoParaEnvio(channelId: number) {
    const channel = await this.findChannel(channelId);
    return this.copiaAnexoParaEnvio(
      channel.saudacao_anexo_key,
      channel.saudacao_anexo_nome,
      channel.saudacao_anexo_mimetype,
      channel.saudacao_anexo_tipo,
    );
  }

  /** Mesma proteção da saudação, para o anexo da despedida. */
  async copiaAnexoDespedidaParaEnvio(channelId: number) {
    const channel = await this.findChannel(channelId);
    return this.copiaAnexoParaEnvio(
      channel.despedida_anexo_key,
      channel.despedida_anexo_nome,
      channel.despedida_anexo_mimetype,
      channel.despedida_anexo_tipo,
    );
  }

  private async copiaAnexoParaEnvio(
    anexoKey: string | null,
    anexoNome: string | null,
    anexoMimetype: string | null,
    anexoTipo: string | null,
  ): Promise<{
    media_key: string;
    media_url: string;
    media_type: string;
    mimetype: string;
    file_name: string;
  } | null> {
    if (!anexoKey) return null;

    const extensao = extname(anexoNome ?? '') || extname(anexoKey) || '';
    const destino = `chat/media/${randomUUID()}${extensao}`;

    await this.storageService.copyObject(anexoKey, destino);

    return {
      media_key: destino,
      media_url: this.storageService.getPublicUrl(destino),
      media_type: anexoTipo,
      mimetype: anexoMimetype,
      file_name: anexoNome,
    };
  }

  /** A coluna guarda a key; a tela precisa da URL para mostrar o anexo. */
  private comUrlDosAnexos(channel: Channels): Channels {
    const comUrl = channel as Channels & {
      saudacao_anexo_url?: string;
      despedida_anexo_url?: string;
    };

    if (channel.saudacao_anexo_key) {
      comUrl.saudacao_anexo_url = this.storageService.getPublicUrl(channel.saudacao_anexo_key);
    }
    if (channel.despedida_anexo_key) {
      comUrl.despedida_anexo_url = this.storageService.getPublicUrl(channel.despedida_anexo_key);
    }

    return comUrl;
  }

  /** Falha ao apagar não derruba a operação: o cadastro já foi alterado. */
  private async removeAnexoTrocado(
    keyAtual: string | null,
    keyNova: string | null | undefined,
  ): Promise<void> {
    const trocou = keyNova !== undefined && keyNova !== keyAtual;
    if (!trocou || !keyAtual) return;

    try {
      await this.storageService.deleteObject(keyAtual);
    } catch (err) {
      this.logger.warn(`Não foi possível remover o anexo ${keyAtual}: ${err.message}`);
    }
  }

  /**
   * `number`, quando informado, pede o código de pareamento (conectar por
   * telefone) em vez do QR - as duas modalidades coexistem na tela, e a
   * escolha é feita a cada tentativa de conexão, não persistida no canal.
   *
   * ⚠️ A Evolution só considera o `number` quando a instância está `close`
   * (confirmado no código-fonte, `instance.controller.ts:connectToWhatsapp`):
   * com uma sessão `connecting` já ativa (QR sendo renovado), ela ignora o
   * parâmetro e devolve o QR que já existia. Por isso, pedir pairing code com
   * uma sessão em andamento primeiro a derruba - transparente para quem clica,
   * sem exigir que a pessoa desconecte manualmente antes.
   */
  async startSession(channelId: number, number?: string): Promise<void> {
    const channel = await this.findChannel(channelId);
    if (!channel) {
      throw new NotFoundException('Canal não localizado com este id');
    }

    // garante que exista um session_id
    if (!channel.session_id) {
      await this.channelsRepository.update(channel.id, { session_id: randomUUID().toUpperCase() });
      const reloaded = await this.channelsRepository.findOneBy({ id: channel.id });
      channel.session_id = reloaded!.session_id;
    }

    if (number && channel.channel_status_id === ChannelStatus.CONNECTING) {
      await this.whatsappService.requestDisconnection(channel.session_id);
      // A Evolution precisa de um instante para marcar a instância como
      // `close` depois do logout - pedir a conexão em seguida, sem esperar,
      // ainda a encontraria `connecting` e cairia na mesma limitação.
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    // O connect do provider já devolve o QR (ou o pairing code, se `number`
    // foi informado) quando a sessão não está conectada - uma chamada basta.
    const result = await this.whatsappService.requestConnection(channel.session_id, number);

    if (result.qrCode || result.pairingCode) {
      await this.channelsRepository.update(channel.id, {
        qr_code: result.qrCode ?? null,
        pairing_code: result.pairingCode ?? null,
        channel_status_id: ChannelStatus.CONNECTING,
      });
      this.handleChannelStatus(channel.id);
      return;
    }

    if (result.state === 'connected') {
      await this.channelsRepository.update(channel.id, {
        qr_code: null,
        pairing_code: null,
        connected_at: channel.connected_at ?? new Date(),
        disconnected_at: null,
        channel_status_id: ChannelStatus.CONNECTED,
      });
      this.handleChannelStatus(channel.id);
    }
  }

  async closeSession(channelId: number) {
    const channel = await this.findChannel(channelId);
    if (!channel) {
      throw new NotFoundException('Canal não localizado com este id');
    }

    if (!channel.session_id) {
      return; // nada a fazer
    }

    await this.whatsappService.requestDisconnection(channel.session_id);
  }

  /**
   * Derruba e reconecta a sessão sem perder o pareamento.
   *
   * Serve à sessão que consta conectada mas parou de entregar mensagens: é o
   * caminho curto, que dispensa desconectar e ler o QR de novo.
   *
   * ⚠️ Só em canal conectado. A Evolution recusa reiniciar instância `close`
   * ("is not connected"), e desconectado é caso de conectar, não de reiniciar.
   */
  async restartSession(channelId: number) {
    const channel = await this.findChannel(channelId);
    if (!channel) {
      throw new NotFoundException('Canal não localizado com este id');
    }

    if (!channel.session_id) {
      throw new BadRequestException('Este canal ainda não tem uma sessão para reiniciar');
    }

    if (channel.channel_status_id !== ChannelStatus.CONNECTED) {
      throw new BadRequestException('Só é possível reiniciar um canal conectado');
    }

    await this.whatsappService.restartConnection(channel.session_id);

    // O estado real vem pelo `connection.update` do webhook, que a Evolution
    // dispara ao derrubar e ao subir de novo - não forçamos status aqui para
    // não brigar com o que o provider vai contar em seguida.
    return { status: 'restarting' };
  }

  // ====== Events Listener Methods ======

  handleChannelStatus(channel_id: number): void {
    this.whatsappService.emitEvent('whatsapp:channel_status', { channel_id });
  }

  async handleSessionStarted(sessionId: string): Promise<void> {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const channel = await this.channelsRepository.findBySessionId(sessionId);
        await manager.update(Channels, channel.id, {
          channel_status_id: ChannelStatus.CONNECTING,
        });
        this.handleChannelStatus(channel.id);
      } catch (error) {
        this.logger.error('Erro ao processar início de sessão do canal WhatsApp:', error);
        throw error;
      }
    });
  }

  /**
   * `pairingCode` só chega por aqui, nunca na resposta síncrona do `connect`:
   * a Evolution devolve o `connect` antes de o Baileys terminar de chamar
   * `requestPairingCode` internamente (delay fixo de 2s, nem sempre
   * suficiente) - o valor definitivo vem depois, neste mesmo webhook que já
   * traz o QR renovado.
   */
  async handleQrCodeReceived(
    payload: WhatsappWebhookPayload<{ qr: string | null; pairingCode?: string | null }>,
  ): Promise<void> {
    const {
      sessionId,
      data: { qr, pairingCode },
    } = payload;
    const channel = await this.channelsRepository.findBySessionId(sessionId);

    return runInTransaction(this.dataSource, async (manager) => {
      try {
        await manager.update(Channels, channel.id, {
          qr_code: qr ?? null,
          // Uma vez gerado, o pairing code fica fixo até a conexão mudar de
          // estado de verdade (conectou/desconectou - outros handlers). O
          // Baileys renova o QR periodicamente e não chama
          // `requestPairingCode` a cada ciclo, então tanto um valor ausente
          // quanto um valor novo neste webhook são ignorados depois que o
          // canal já tem um código - trocá-lo no meio da tentativa invalidaria
          // o que o atendente já está digitando no celular.
          pairing_code: channel.pairing_code ?? (pairingCode ?? null),
          channel_status_id: ChannelStatus.CONNECTING,
        });
        this.handleChannelStatus(channel.id);
      } catch (error) {
        this.logger.error('Erro ao processar QR Code recebido do canal WhatsApp:', error);
        throw error;
      }
    });
  }

  async handleChannelAuthenticated(payload: WhatsappWebhookPayload): Promise<void> {
    const { sessionId } = payload;
    const channel = await this.channelsRepository.findBySessionId(sessionId);

    try {
      await this.channelsRepository.update(channel.id, {
        qr_code: null,
        pairing_code: null,
        connected_at: new Date(),
        disconnected_at: null,
        channel_status_id: ChannelStatus.CONNECTED,
      });
      this.handleChannelStatus(channel.id);
    } catch (error) {
      this.logger.error('Erro ao processar autenticação do canal WhatsApp:', error);
      throw error;
    }
  }

  async handleChannelReady(payload: WhatsappWebhookPayload): Promise<void> {
    const { sessionId } = payload;
    const channel = await this.channelsRepository.findBySessionId(sessionId);

    try {
      // O provider pode informar o número já no payload da conexão; se não
      // vier, consulta a sessão.
      const phoneFromPayload = (payload.data as { wuid?: string })?.wuid;
      let phoneNumber = channel.phone_number;

      if (!phoneNumber) {
        const digits = phoneFromPayload?.split('@')[0]?.replace(/\D/g, '');
        phoneNumber = digits
          ? digits.slice(-10)
          : ((await this.whatsappService.getClientInfo(sessionId))?.phoneNumber?.slice(-10) ??
            null);
      }

      await this.channelsRepository.update(channel.id, {
        qr_code: null,
        pairing_code: null,
        connected_at: channel.connected_at ?? new Date(),
        disconnected_at: null,
        channel_status_id: ChannelStatus.CONNECTED,
        ...(phoneNumber && { phone_number: phoneNumber }),
      });
      this.handleChannelStatus(channel.id);
    } catch (error) {
      this.logger.error('Erro ao processar conexão do canal WhatsApp:', error);
      throw error;
    }
  }

  /**
   * Consulta o estado da sessão no provider e alinha o nosso banco a ele.
   *
   * O status que guardamos é o último que um evento `connection.update` nos
   * contou - e evento se perde. Quando isso acontece o portal mostra
   * "Conectado" para um canal que caiu, e a falha só aparece quando alguém
   * tenta enviar. Este método é a fonte da verdade sob demanda.
   */
  async sincronizarStatus(channelId: number): Promise<Channels> {
    const channel = await this.findChannel(channelId);

    if (!channel.session_id) {
      throw new BadRequestException('O canal ainda não possui uma sessão para consultar.');
    }

    const estado = await this.whatsappService.fetchConnectionStatus(channel.session_id);

    // Sessão inexistente no provider é tratada como desconectada: para o
    // atendente o efeito é o mesmo, e o start recria a instância.
    const statusReal =
      estado === 'connected'
        ? ChannelStatus.CONNECTED
        : estado === 'connecting'
          ? ChannelStatus.CONNECTING
          : ChannelStatus.DISCONNECTED;

    if (channel.channel_status_id === statusReal) {
      return channel;
    }

    this.logger.warn(
      `Status do canal ${channel.id} dessincronizado: banco=${channel.channel_status_id}, provider=${statusReal}. Corrigindo.`,
    );

    const conectou = statusReal === ChannelStatus.CONNECTED;

    await this.channelsRepository.update(channel.id, {
      channel_status_id: statusReal,
      ...(conectou
        ? { connected_at: channel.connected_at ?? new Date(), disconnected_at: null }
        : {
            disconnected_at: new Date(),
            connected_at: null,
            qr_code: null,
            pairing_code: null,
          }),
    });

    this.handleChannelStatus(channel.id);

    return this.channelsRepository.findOne({
      where: { id: channel.id },
      relations: ['channelStatus'],
    });
  }

  async handleChannelDisconnected(
    payload: WhatsappWebhookPayload<{ reason: string }>,
  ): Promise<void> {
    const { sessionId } = payload;
    const channel = await this.channelsRepository.findBySessionId(sessionId);

    try {
      await this.channelsRepository.update(channel.id, {
        qr_code: null,
        pairing_code: null,
        disconnected_at: new Date(),
        connected_at: null,
        channel_status_id: ChannelStatus.DISCONNECTED,
        phone_number: null,
      });
      this.handleChannelStatus(channel.id);
    } catch (error) {
      this.logger.error('Erro ao processar desconexão do canal WhatsApp:', error);
      throw error;
    }
  }
}
