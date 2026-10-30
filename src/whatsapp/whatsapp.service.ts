import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';

import { ChannelsRepository } from 'channels/channels.repository';
import { Channels } from 'channels/entities/channels.entity';
import { MessageMedia, WhatsappWebhookPayload } from '@types';
import { EvolutionProvider } from './providers/evolution/evolution.provider';
import { EvolutionWebhookBody } from './providers/evolution/evolution.types';
import { EvolutionWebhookInterpreter } from './providers/evolution/evolution.webhook-interpreter';
import {
  ProviderClientInfo,
  ProviderConnectionStatus,
  ProviderConnectionResult,
  ProviderDesconexao,
  ProviderMediaPayload,
  ProviderMessageRef,
  ProviderNumeroVerificado,
  ProviderSentMessage,
} from './providers/whatsapp-provider.interface';
import { WhatsappGateway } from './whatsapp.gateway';

/**
 * Fachada de WhatsApp da aplicação.
 *
 * Mantém as filas, o roteamento de webhooks e a emissão de eventos por socket,
 * delegando as chamadas ao `EvolutionProvider` (único gateway suportado hoje).
 * Os consumidores (`ChannelsService`, `SupportChatsService`, `ContactsService`,
 * `MessagesService`) seguem chamando por `sessionId`, sem conhecer o provider.
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
    private readonly evolutionProvider: EvolutionProvider,
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

    // Quem entende o formato da Evolution é o interpretador, dentro de
    // `providers/evolution/`: aqui só se decide a fila e se enfileira.
    const interpretado = EvolutionWebhookInterpreter.interpretar(body);
    if (!interpretado) return;

    const { dataType, payload, chaveDaFila, ehEventoDeSessao } = interpretado;

    if (!payload) {
      this.logger.debug(`Evento ${event} sem dados aproveitáveis; ignorado.`);
      return;
    }

    const queue = ehEventoDeSessao ? this.sessionQueue : this.messagesQueue;
    const prefix = ehEventoDeSessao ? 'whatsapp-session' : 'whatsapp-message';

    await queue.add(`${prefix}-${instance}`, payload, { jobId: chaveDaFila });
    this.logger.log(`Evento enfileirado: ${event} -> ${dataType} (job ${chaveDaFila})`);
  }

  // == Emissão para os clientes ==

  emitEvent(event: string, payload: unknown): void {
    this.whatsappGateway.emitEvent(event, payload);
  }

  /** Só chega a quem pode ver aquele atendimento - ver `emitSupportChatState`. */
  async emitSupportChatState(
    dono: number | null | undefined,
    event: string,
    payload: unknown,
  ): Promise<void> {
    await this.whatsappGateway.emitSupportChatState(dono, event, payload);
  }

  /** Só chega a quem pode ver aquele atendimento - ver `emitSupportChatMessage`. */
  async emitSupportChatMessage(
    dono: number | null | undefined,
    event: string,
    payload: unknown,
  ): Promise<void> {
    await this.whatsappGateway.emitSupportChatMessage(dono, event, payload);
  }

  // == Chamadas ao provider ==

  async requestConnection(sessionId: string, number?: string): Promise<ProviderConnectionResult> {
    // Com o token: reconectar uma instância que já existe deve usar o token
    // dela, e `findBySessionId` não traz a coluna (`select: false`) - o canal
    // chegaria sem ele e a chamada cairia na chave global.
    const channel = await this.channelsRepository.findBySessionIdWithToken(sessionId);
    const result = await this.evolutionProvider.requestConnection(
      this.sessaoDoCanal(channel),
      number,
    );

    // A Evolution devolve o token da instância apenas na criação.
    if (result.instanceToken) {
      await this.channelsRepository.update(channel.id, {
        instance_token: result.instanceToken,
      });
    }

    // Toda conexão reaplica as preferências: é o único momento garantido em
    // que a instância existe no provider. Também reenvia a assinatura de
    // eventos do webhook, que só é aplicada na criação da instância - sem
    // isto, canal antigo nunca receberia o evento de chamada.
    await this.aplicarPreferencias(sessionId, {
      ...(result.instanceToken && { instanceToken: result.instanceToken }),
    });

    return result;
  }

  /**
   * Reaplica no provider as preferências do canal (rejeição de chamadas) e a
   * assinatura do webhook. Chamada ao conectar e ao salvar o cadastro.
   *
   * Falha aqui não propaga: o cadastro já foi salvo e a conexão já aconteceu;
   * a preferência volta a ser tentada na próxima conexão.
   */
  async aplicarPreferencias(
    sessionId: string,
    extras?: { instanceToken?: string },
  ): Promise<void> {
    try {
      const channel = await this.channelsRepository.findBySessionIdWithToken(sessionId);
      if (!channel) return;

      await this.evolutionProvider.aplicarPreferencias(
        {
          ...this.sessaoDoCanal(channel),
          ...(extras?.instanceToken && { instanceToken: extras.instanceToken }),
        },
        { rejeitarChamadas: Boolean(channel.rejeitar_chamadas) },
      );
    } catch (error) {
      this.logger.warn(`Falha ao aplicar preferências do canal ${sessionId}: ${error.message}`);
    }
  }

  async requestQrCode(sessionId: string): Promise<string | null> {
    const { provider, session } = await this.resolve(sessionId);
    return provider.requestQrCode(session);
  }

  async requestDisconnection(sessionId: string): Promise<ProviderDesconexao> {
    const { provider, session } = await this.resolve(sessionId);
    return provider.requestDisconnection(session);
  }

  async restartConnection(sessionId: string): Promise<void> {
    const { provider, session } = await this.resolve(sessionId);
    this.logger.log(`Reiniciando a sessão ${sessionId}`);
    return provider.restartConnection(session);
  }

  /** Estado da sessão no provider, consultado na hora. */
  async fetchConnectionStatus(sessionId: string): Promise<ProviderConnectionStatus | null> {
    const { provider, session } = await this.resolve(sessionId);
    return provider.fetchConnectionStatus(session);
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

  /**
   * Se o número tem WhatsApp, e qual o JID dele.
   *
   * Sem `sessionId`, diferente dos demais: quem chama é o cadastro de contato,
   * que não parte de uma conversa. Escolhe um canal conectado qualquer - a
   * pergunta é sobre o número consultado, não sobre a sessão.
   *
   * `null` quando nenhum canal está conectado, quando o provider não responde
   * ou quando o número é inválido. O cadastro segue sem o JID nesses casos:
   * indisponibilidade de terceiro não pode travar o registro de um contato.
   */
  /** `@lid` → JID com telefone, pelo canal informado. `null` se não souber. */
  async resolveLid(sessionId: string, lid: string): Promise<string | null> {
    try {
      const { provider, session } = await this.resolve(sessionId);
      return provider.resolveLid(session, lid);
    } catch (erro) {
      this.logger.warn(`Falha ao resolver o LID ${lid}: ${erro.message}`);
      return null;
    }
  }

  async verificaNumero(numero: string): Promise<ProviderNumeroVerificado | null> {
    const channel = await this.channelsRepository.findQualquerConectado();

    if (!channel) {
      this.logger.warn('Nenhum canal conectado para verificar número no WhatsApp');
      return null;
    }

    try {
      const { provider, session } = await this.resolve(channel.session_id);
      return provider.verificaNumero(session, numero);
    } catch (erro) {
      this.logger.warn(`Falha ao verificar número ${numero}: ${erro.message}`);
      return null;
    }
  }

  async downloadMedia(sessionId: string, messageId: string, chatId: string): Promise<MessageMedia> {
    const { provider, session } = await this.resolve(sessionId);
    return provider.downloadMedia(session, messageId, chatId);
  }

  async sendMessage(
    sessionId: string,
    to: string,
    message: string,
    typingDelayMs?: number,
  ): Promise<ProviderSentMessage> {
    const { provider, session } = await this.resolve(sessionId);
    this.logger.log(`Enviando mensagem para ${to}`);
    return provider.sendMessage(session, to, message, typingDelayMs);
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
    fromMe: boolean,
  ): Promise<void> {
    const { provider, session } = await this.resolve(sessionId);
    return provider.sendReaction(session, chatId, messageId, reaction, fromMe);
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

  /** Provider + sessão a partir do `session_id`. */
  private async resolve(sessionId: string) {
    const channel = await this.channelsRepository.findBySessionIdWithToken(sessionId);
    return { provider: this.evolutionProvider, session: this.sessaoDoCanal(channel) };
  }

  /** A referência de sessão que o provider espera, a partir do canal carregado. */
  private sessaoDoCanal(
    channel: Pick<Channels, 'id' | 'session_id'> & { instance_token?: string | null },
  ) {
    if (!channel.session_id) {
      throw new BadRequestException('O canal não possui uma sessão associada.');
    }

    return {
      sessionId: channel.session_id,
      instanceToken: channel.instance_token ?? null,
      channelId: channel.id,
    };
  }

  /** Exposto para o webhook validar o segredo da integração do canal. */
  async findChannelBySession(sessionId: string): Promise<Channels | null> {
    return this.channelsRepository.findBySessionId(sessionId, false);
  }
}
