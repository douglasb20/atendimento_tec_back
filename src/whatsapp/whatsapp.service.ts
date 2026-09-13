import { InjectQueue } from '@nestjs/bullmq';
import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { ChannelsRepository } from 'channels/channels.repository';
import { Channels } from 'channels/entities/channels.entity';
import { DataTypeWhatsapp, MessageMedia, WhatsappWebhookPayload } from '@types';
import { EvolutionMapper } from './providers/evolution/evolution.mapper';
import { EvolutionWebhookBody } from './providers/evolution/evolution.types';
import { ProviderFactory } from './providers/provider.factory';
import {
  ProviderClientInfo,
  ProviderConnectionResult,
  ProviderMediaPayload,
  ProviderMessageRef,
  ProviderSentMessage,
} from './providers/whatsapp-provider.interface';
import { WhatsappGateway } from './whatsapp.gateway';

/**
 * Fachada de WhatsApp da aplicação.
 *
 * Mantém as filas, o roteamento de webhooks e a emissão de eventos por socket,
 * delegando as chamadas ao provider resolvido para o canal. Os consumidores
 * (`ChannelsService`, `SupportChatsService`, `ContactsService`, `MessagesService`)
 * seguem chamando por `sessionId`, sem conhecer qual provider está por trás.
 */
@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    @InjectQueue('whatsapp-messages-queue')
    private readonly messagesQueue: Queue<WhatsappWebhookPayload>,
    @InjectQueue('whatsapp-session-queue')
    private readonly sessionQueue: Queue<WhatsappWebhookPayload>,
    private readonly whatsappGateway: WhatsappGateway,
    private readonly providerFactory: ProviderFactory,
    @Inject(forwardRef(() => ChannelsRepository))
    private readonly channelsRepository: ChannelsRepository,
  ) {}

  // == Recebimento de eventos ==

  /**
   * Normaliza o envelope da Evolution e enfileira o evento.
   *
   * Eventos sem interesse para o domínio são descartados silenciosamente - a
   * Evolution pode enviar mais tipos do que assinamos.
   */
  async processWebhook(body: EvolutionWebhookBody): Promise<void> {
    const { event, instance } = body;


    const dataType = this.resolveDataType(body);

    if (!dataType) {
      this.logger.debug(`Evento ignorado: ${event} (instância ${instance})`);
      return;
    }

    const payload = this.normalizePayload(body, dataType);
    if (!payload) {
      this.logger.debug(`Evento ${event} sem dados aproveitáveis; ignorado.`);
      return;
    }

    const key = this.getChatKey(body, dataType);
    const queue = this.isSessionEvent(dataType) ? this.sessionQueue : this.messagesQueue;
    const prefix = this.isSessionEvent(dataType) ? 'whatsapp-session' : 'whatsapp-message';

    await queue.add(`${prefix}-${instance}`, payload, { jobId: key });
    this.logger.log(`Evento enfileirado: ${event} -> ${dataType} (job ${key})`);
  }

  /** Descobre o tipo interno; `connection.update` depende do estado recebido. */
  private resolveDataType(body: EvolutionWebhookBody): DataTypeWhatsapp | null {
    const mapped = EvolutionMapper.mapEventType(body.event);

    if (mapped === DataTypeWhatsapp.STATE_CHANGED) {
      return EvolutionMapper.mapConnectionState(body.data as never);
    }

    // Reação chega como mensagem contendo reactionMessage.
    if (mapped === DataTypeWhatsapp.MESSAGE_CREATE && this.isReaction(body)) {
      return DataTypeWhatsapp.MESSAGE_REACTION;
    }

    return mapped;
  }

  /** Converte o `data` da Evolution para o formato que os handlers consomem. */
  private normalizePayload(
    body: EvolutionWebhookBody,
    dataType: DataTypeWhatsapp,
  ): WhatsappWebhookPayload | null {
    const { data } = body;

    // Sem JID não há conversa a que vincular o evento: o mapper preencheria os
    // campos com string vazia e gravaria uma mensagem órfã. Descartar aqui,
    // como já se faz com reação, QR e contagem de não lidas.
    const exigeRemoteJid = [
      DataTypeWhatsapp.MESSAGE_CREATE,
      DataTypeWhatsapp.MESSAGE_EDIT,
      DataTypeWhatsapp.MESSAGE_ACK,
      DataTypeWhatsapp.MESSAGE_REVOKED_EVERYONE,
    ].includes(dataType);

    if (exigeRemoteJid && !EvolutionMapper.extractRemoteJid(body.event, data)) {
      this.logger.warn(`Evento ${body.event} sem remoteJid descartado (instância ${body.instance})`);
      return null;
    }

    switch (dataType) {
      case DataTypeWhatsapp.MESSAGE_CREATE:
        return EvolutionMapper.toInternalPayload(body, dataType, {
          message: EvolutionMapper.mapUpsert(data as never),
        });

      case DataTypeWhatsapp.MESSAGE_EDIT:
        return EvolutionMapper.toInternalPayload(body, dataType, {
          message: EvolutionMapper.mapEdited(data as never),
        });

      case DataTypeWhatsapp.MESSAGE_ACK:
        return EvolutionMapper.toInternalPayload(body, dataType, {
          message: EvolutionMapper.mapUpdate(data as never),
        });

      case DataTypeWhatsapp.MESSAGE_REVOKED_EVERYONE:
        return EvolutionMapper.toInternalPayload(body, dataType, {
          message: EvolutionMapper.mapDeleted(data as never),
        });

      case DataTypeWhatsapp.MESSAGE_REACTION: {
        const reaction = EvolutionMapper.mapReaction(data as never);
        return reaction ? EvolutionMapper.toInternalPayload(body, dataType, { reaction }) : null;
      }

      case DataTypeWhatsapp.QR_RECEIVED: {
        const qr = EvolutionMapper.mapQrCode(data as never);
        return qr ? EvolutionMapper.toInternalPayload(body, dataType, { qr }) : null;
      }

      case DataTypeWhatsapp.UNREAD_COUNT: {
        const chat = Array.isArray(data) ? data[0] : data;
        const remoteJid =
          (chat as { remoteJid?: string; id?: string })?.remoteJid ?? (chat as { id?: string })?.id;
        if (!remoteJid) return null;

        return EvolutionMapper.toInternalPayload(body, dataType, {
          chat: {
            id: { _serialized: remoteJid },
            unreadCount: (chat as { unreadCount?: number })?.unreadCount ?? 0,
          },
        });
      }

      case DataTypeWhatsapp.READY:
      case DataTypeWhatsapp.DISCONNECTED:
      case DataTypeWhatsapp.AUTHENTICATED:
        return EvolutionMapper.toInternalPayload(body, dataType, data);

      default:
        return null;
    }
  }

  private isReaction(body: EvolutionWebhookBody): boolean {
    const data = body.data as { message?: { reactionMessage?: unknown }; messageType?: string };
    return Boolean(data?.message?.reactionMessage) || data?.messageType === 'reactionMessage';
  }

  private isSessionEvent(dataType: DataTypeWhatsapp): boolean {
    return [
      DataTypeWhatsapp.QR_RECEIVED,
      DataTypeWhatsapp.AUTHENTICATED,
      DataTypeWhatsapp.READY,
      DataTypeWhatsapp.DISCONNECTED,
    ].includes(dataType);
  }

  /**
   * Chave do job. O formato agrupa por conversa e mantém a unicidade por
   * evento, preservando a ordenação garantida pela concorrência 1 do processor.
   */
  private getChatKey(body: EvolutionWebhookBody, dataType: DataTypeWhatsapp): string {
    const remoteJid = EvolutionMapper.extractRemoteJid(body.event, body.data);

    if (!remoteJid) {
      return `${body.instance}-${dataType}_${Date.now()}`;
    }

    // O BullMQ recusa `:` no jobId, e o JID pode trazer sufixo de dispositivo
    // (`222226020307023:45@lid`). Trocar por `-` mantém a chave estável por
    // conversa, que é o que garante a ordenação.
    return `${body.instance}-${remoteJid.replace(/:/g, '-')}_${Date.now()}`;
  }

  // == Emissão para os clientes ==

  emitEvent(event: string, payload: unknown): void {
    this.whatsappGateway.emitEvent(event, payload);
  }

  // == Chamadas ao provider ==

  async requestConnection(sessionId: string): Promise<ProviderConnectionResult> {
    const channel = await this.channelsRepository.findBySessionId(sessionId);
    const { provider, session } = await this.providerFactory.forChannel(channel);

    const result = await provider.requestConnection(session);

    // A Evolution devolve o token da instância apenas na criação.
    if (result.instanceToken) {
      await this.channelsRepository.update(channel.id, {
        instance_token: result.instanceToken,
      });
    }

    return result;
  }

  async requestQrCode(sessionId: string): Promise<string | null> {
    const { provider, session } = await this.resolve(sessionId);
    return provider.requestQrCode(session);
  }

  async requestDisconnection(sessionId: string): Promise<void> {
    const { provider, session } = await this.resolve(sessionId);
    return provider.requestDisconnection(session);
  }

  async getClientInfo(sessionId: string): Promise<ProviderClientInfo> {
    const { provider, session } = await this.resolve(sessionId);
    return provider.getClientInfo(session);
  }

  async getProfilePicUrl(sessionId: string, remoteJid: string): Promise<string> {
    const { provider, session } = await this.resolve(sessionId);
    return provider.getProfilePicUrl(session, remoteJid);
  }

  async getFormattedNumber(sessionId: string, remoteJid: string): Promise<string> {
    const { provider, session } = await this.resolve(sessionId);
    return provider.getFormattedNumber(session, remoteJid);
  }

  async downloadMedia(sessionId: string, messageId: string, chatId: string): Promise<MessageMedia> {
    const { provider, session } = await this.resolve(sessionId);
    return provider.downloadMedia(session, messageId, chatId);
  }

  async sendMessage(sessionId: string, to: string, message: string): Promise<ProviderSentMessage> {
    const { provider, session } = await this.resolve(sessionId);
    this.logger.log(`Enviando mensagem para ${to}`);
    return provider.sendMessage(session, to, message);
  }

  async replyMessage(
    sessionId: string,
    chatId: string,
    messageId: string,
    message: string,
  ): Promise<ProviderSentMessage> {
    const { provider, session } = await this.resolve(sessionId);
    this.logger.log(`Respondendo mensagem em ${chatId}`);
    return provider.replyMessage(session, chatId, messageId, message);
  }

  async sendReaction(
    sessionId: string,
    chatId: string,
    messageId: string,
    reaction: string,
  ): Promise<void> {
    const { provider, session } = await this.resolve(sessionId);
    return provider.sendReaction(session, chatId, messageId, reaction);
  }

  async sendMedia(sessionId: string, media: ProviderMediaPayload): Promise<ProviderSentMessage> {
    const { provider, session } = await this.resolve(sessionId);
    return provider.sendMedia(session, media);
  }

  async editMessage(
    sessionId: string,
    chatId: string,
    messageId: string,
    texto: string,
  ): Promise<void> {
    const { provider, session } = await this.resolve(sessionId);
    return provider.editMessage(session, chatId, messageId, texto);
  }

  async markAsRead(sessionId: string, mensagens: ProviderMessageRef[]): Promise<void> {
    const { provider, session } = await this.resolve(sessionId);
    return provider.markAsRead(session, mensagens);
  }

  async deleteMessage(
    sessionId: string,
    chatId: string,
    messageId: string,
    fromMe: boolean,
  ): Promise<void> {
    const { provider, session } = await this.resolve(sessionId);
    return provider.deleteMessage(session, chatId, messageId, fromMe);
  }

  /** Canal + provider + sessão a partir do `session_id`. */
  private async resolve(sessionId: string) {
    const channel = await this.channelsRepository.findBySessionIdWithToken(sessionId);
    return this.providerFactory.forChannel(channel);
  }

  /** Exposto para o webhook validar o segredo da integração do canal. */
  async findChannelBySession(sessionId: string): Promise<Channels | null> {
    return this.channelsRepository.findBySessionId(sessionId, false);
  }
}
