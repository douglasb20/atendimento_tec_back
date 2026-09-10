import { BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import axios, { AxiosInstance, isAxiosError } from 'axios';

import { MessageMedia } from '@types';
import { ResolvedIntegration } from 'integrations/integrations.service';
import {
  ProviderClientInfo,
  ProviderConnectionResult,
  ProviderMediaPayload,
  ProviderMediaType,
  ProviderSentMessage,
  ProviderSessionRef,
  WhatsappProvider,
} from '../whatsapp-provider.interface';
import { EvolutionMapper } from './evolution.mapper';
import {
  EvolutionBase64Response,
  EvolutionConnectionStateResponse,
  EvolutionConnectResponse,
  EvolutionInstanceCreateResponse,
  EvolutionSendResponse,
} from './evolution.types';

/** Eventos que pedimos à Evolution — nomes em UPPER_SNAKE, como a config dela espera. */
const SUBSCRIBED_EVENTS = [
  'QRCODE_UPDATED',
  'CONNECTION_UPDATE',
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  'MESSAGES_EDITED',
  'MESSAGES_DELETE',
  'SEND_MESSAGE',
  'CONTACTS_UPDATE',
  'CHATS_UPDATE',
];

/** Tipos internos de mídia → `mediatype` da Evolution. */
const MEDIA_TYPE_MAP: Record<ProviderMediaType, string> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  document: 'document',
  sticker: 'image',
};

/**
 * Implementação do provider para a Evolution API v2.3.7 (Baileys).
 *
 * Cada instância é construída para uma integração específica: a URL base e a
 * apikey vêm do banco, não de variáveis de ambiente, porque podem coexistir
 * várias integrações.
 */
export class EvolutionProvider implements WhatsappProvider {
  readonly slug = 'evolution';

  private readonly logger = new Logger(EvolutionProvider.name);
  private readonly http: AxiosInstance;

  constructor(
    private readonly integration: ResolvedIntegration,
    private readonly webhookUrl: string,
  ) {
    if (!integration.base_url) {
      throw new BadRequestException(
        `A integração "${integration.name}" não tem base_url configurada.`,
      );
    }

    this.http = axios.create({
      baseURL: integration.base_url.replace(/\/+$/, ''),
      headers: {
        'Content-Type': 'application/json',
        // A Evolution autentica por um header `apikey` simples (não Bearer).
        apikey: integration.credentials?.apiKey ?? '',
      },
      timeout: 30_000,
    });
  }

  async requestConnection(session: ProviderSessionRef): Promise<ProviderConnectionResult> {
    const state = await this.fetchConnectionState(session.sessionId);

    // Instância ainda não existe na Evolution: cria já com o webhook configurado.
    if (state === null) {
      return this.createInstance(session);
    }

    if (state === 'open') {
      return { state: 'connected' };
    }

    return this.connectInstance(session);
  }

  async requestQrCode(session: ProviderSessionRef): Promise<string | null> {
    const result = await this.connectInstance(session);
    return result.qrCode ?? null;
  }

  async requestDisconnection(session: ProviderSessionRef): Promise<void> {
    try {
      await this.http.delete(`/instance/logout/${session.sessionId}`);
      this.logger.log(`Sessão encerrada: ${session.sessionId}`);
    } catch (error) {
      // Já desconectada ou inexistente: não é falha do ponto de vista do domínio.
      if (this.statusOf(error) === 404) {
        this.logger.warn(`Sessão ${session.sessionId} já não existe na Evolution.`);
        return;
      }
      this.fail('Falha ao encerrar a sessão do WhatsApp', error);
    }
  }

  async getClientInfo(session: ProviderSessionRef): Promise<ProviderClientInfo> {
    try {
      const { data } = await this.http.get<{ instance?: Record<string, unknown> }[]>(
        `/instance/fetchInstances`,
        { params: { instanceName: session.sessionId } },
      );

      const instances = Array.isArray(data) ? data : [data];
      const found = instances.find((item) => {
        const candidate = (item?.instance ?? item) as Record<string, unknown>;
        return (
          candidate?.name === session.sessionId || candidate?.instanceName === session.sessionId
        );
      });

      const instance = (found?.instance ?? found ?? {}) as Record<string, string>;

      return {
        phoneNumber: EvolutionMapper.extractPhoneFromWuid(
          instance.ownerJid ?? instance.owner ?? instance.wuid,
        ),
        pushName: instance.profileName ?? null,
        profilePicUrl: instance.profilePicUrl ?? null,
      };
    } catch (error) {
      this.fail('Falha ao obter informações da sessão do WhatsApp', error);
    }
  }

  async getProfilePicUrl(session: ProviderSessionRef, remoteJid: string): Promise<string> {
    try {
      const { data } = await this.http.post<{ profilePictureUrl?: string }>(
        `/chat/fetchProfilePictureUrl/${session.sessionId}`,
        { number: this.toNumber(remoteJid) },
      );
      return data?.profilePictureUrl ?? '';
    } catch (error) {
      // Contato sem foto ou com privacidade restrita é caso normal.
      this.logger.warn(
        `Não foi possível obter a foto de perfil de ${remoteJid}: ${this.messageOf(error)}`,
      );
      return '';
    }
  }

  async getFormattedNumber(_session: ProviderSessionRef, remoteJid: string): Promise<string> {
    // O JID já carrega o número; não é preciso ir à rede.
    return this.toNumber(remoteJid);
  }

  async downloadMedia(
    session: ProviderSessionRef,
    messageId: string,
    chatId: string,
  ): Promise<MessageMedia> {
    try {
      const { data } = await this.http.post<EvolutionBase64Response>(
        `/chat/getBase64FromMediaMessage/${session.sessionId}`,
        {
          // Só a key basta: a Evolution completa a mensagem a partir do banco dela.
          message: { key: { id: messageId, remoteJid: chatId } },
        },
      );

      if (!data?.base64) {
        throw new InternalServerErrorException('A Evolution não retornou o conteúdo da mídia.');
      }

      return {
        mimetype: data.mimetype ?? 'application/octet-stream',
        data: data.base64,
        filename: data.fileName ?? null,
        filesize: Number(data.size?.fileLength ?? 0) || null,
      };
    } catch (error) {
      this.fail('Falha ao baixar a mídia da mensagem', error);
    }
  }

  async sendMessage(
    session: ProviderSessionRef,
    to: string,
    message: string,
  ): Promise<ProviderSentMessage> {
    try {
      const { data } = await this.http.post<EvolutionSendResponse>(
        `/message/sendText/${session.sessionId}`,
        { number: this.toNumber(to), text: message },
      );
      return this.toSentMessage(data);
    } catch (error) {
      this.fail('Não foi possível enviar a mensagem', error);
    }
  }

  async replyMessage(
    session: ProviderSessionRef,
    chatId: string,
    messageId: string,
    message: string,
  ): Promise<ProviderSentMessage> {
    try {
      const { data } = await this.http.post<EvolutionSendResponse>(
        `/message/sendText/${session.sessionId}`,
        {
          number: this.toNumber(chatId),
          text: message,
          // Informando só a key.id, a Evolution recupera a mensagem citada.
          quoted: { key: { id: messageId } },
        },
      );
      return this.toSentMessage(data);
    } catch (error) {
      this.fail('Não foi possível responder a mensagem', error);
    }
  }

  async sendReaction(
    session: ProviderSessionRef,
    chatId: string,
    messageId: string,
    reaction: string,
  ): Promise<void> {
    try {
      // sendReaction não usa `number`: o destino sai do próprio key.remoteJid.
      await this.http.post(`/message/sendReaction/${session.sessionId}`, {
        key: { id: messageId, remoteJid: this.toJid(chatId), fromMe: false },
        reaction,
      });
    } catch (error) {
      if (this.statusOf(error) === 400) {
        throw new BadRequestException('Mensagem não encontrada para adicionar reação.');
      }
      this.fail('Não foi possível enviar a reação', error);
    }
  }

  async sendMedia(
    session: ProviderSessionRef,
    payload: ProviderMediaPayload,
  ): Promise<ProviderSentMessage> {
    const { to, mediaType, media, mimetype, caption, fileName, quotedMessageId } = payload;

    // Vídeo/áudio/documento são aceitos por URL: a Evolution repassa ao Baileys,
    // que baixa direto — sem trafegar bytes por aqui nem passar por browser.
    const body: Record<string, unknown> = {
      number: this.toNumber(to),
      mediatype: MEDIA_TYPE_MAP[mediaType],
      media,
      ...(mimetype && { mimetype }),
      ...(caption && { caption }),
      ...(fileName && { fileName }),
      ...(quotedMessageId && { quoted: { key: { id: quotedMessageId } } }),
    };

    // Documento sem nome de arquivo é rejeitado quando a mídia vem em base64.
    if (mediaType === 'document' && !fileName) {
      body.fileName = 'documento';
    }

    const endpoint =
      mediaType === 'sticker'
        ? `/message/sendSticker/${session.sessionId}`
        : `/message/sendMedia/${session.sessionId}`;

    if (mediaType === 'sticker') {
      delete body.mediatype;
      body.sticker = media;
      delete body.media;
    }

    // O provider baixa a mídia da URL que enviamos, e esse download pode falhar
    // por instabilidade de rede até o storage — sem timeout configurável do lado
    // dele. Uma nova tentativa costuma resolver, então vale insistir antes de
    // devolver erro ao atendente.
    const tentativas = 3;
    for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
      try {
        const { data } = await this.http.post<EvolutionSendResponse>(endpoint, body);
        this.logger.log(`Mídia (${mediaType}) enviada para ${to}`);
        return this.toSentMessage(data);
      } catch (error) {
        const ultima = tentativa === tentativas;
        if (ultima || !this.isFalhaTransitoriaDeMidia(error)) {
          this.fail('Não foi possível enviar a mídia', error);
        }

        this.logger.warn(
          `Falha ao enviar mídia (tentativa ${tentativa}/${tentativas}): ${this.messageOf(error)}. Tentando novamente...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000 * tentativa));
      }
    }

    // Inalcançável: o laço acima sempre retorna ou lança.
    throw new InternalServerErrorException('Não foi possível enviar a mídia');
  }

  /**
   * Distingue falha de rede ao buscar a mídia (vale repetir) de erro de
   * validação como tipo inválido ou número inexistente (repetir não ajuda).
   */
  private isFalhaTransitoriaDeMidia(error: unknown): boolean {
    const status = this.statusOf(error);
    if (status && status < 500) return false;

    const detalhe = this.messageOf(error).toLowerCase();
    return (
      detalhe.includes('fetch failed') ||
      detalhe.includes('etimedout') ||
      detalhe.includes('econnreset') ||
      detalhe.includes('socket hang up') ||
      detalhe.includes('network') ||
      status === undefined
    );
  }

  // == Internos ==

  /** Estado atual da instância, ou null quando ela não existe na Evolution. */
  private async fetchConnectionState(instanceName: string): Promise<string | null> {
    try {
      const { data } = await this.http.get<EvolutionConnectionStateResponse>(
        `/instance/connectionState/${instanceName}`,
      );
      return data?.instance?.state ?? 'close';
    } catch (error) {
      // O guard de existência da Evolution responde 404 antes da autenticação.
      if (this.statusOf(error) === 404) return null;
      this.fail('Falha ao consultar o estado da sessão do WhatsApp', error);
    }
  }

  private async createInstance(session: ProviderSessionRef): Promise<ProviderConnectionResult> {
    try {
      const { data } = await this.http.post<EvolutionInstanceCreateResponse>('/instance/create', {
        instanceName: session.sessionId,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: {
          enabled: true,
          url: this.webhookUrl,
          byEvents: false,
          base64: false,
          events: SUBSCRIBED_EVENTS,
          // Segredo próprio: o campo `apikey` do corpo do webhook vem nulo por padrão.
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': this.integration.webhook_secret ?? '',
          },
        },
      });

      this.logger.log(`Instância criada na Evolution: ${session.sessionId}`);

      return {
        state: 'connecting',
        qrCode: data?.qrcode?.code ?? null,
        instanceToken: data?.hash ?? null,
      };
    } catch (error) {
      // 403 = nome já existe; nesse caso basta conectar.
      if (this.statusOf(error) === 403) {
        this.logger.warn(`Instância ${session.sessionId} já existe; conectando.`);
        return this.connectInstance(session);
      }
      this.fail('Falha ao criar a instância do WhatsApp', error);
    }
  }

  /**
   * Conecta e normaliza o retorno, que é polimórfico: pode trazer o estado, o
   * objeto de QR cru, ou um erro — sempre com HTTP 200.
   */
  private async connectInstance(session: ProviderSessionRef): Promise<ProviderConnectionResult> {
    try {
      const { data } = await this.http.get<EvolutionConnectResponse>(
        `/instance/connect/${session.sessionId}`,
      );

      if (data?.error) {
        const detail = Array.isArray(data.message) ? data.message.join('; ') : data.message;
        throw new InternalServerErrorException(
          `Falha ao conectar a sessão do WhatsApp: ${detail ?? 'erro não informado'}`,
        );
      }

      const state = data?.instance?.state;
      if (state === 'open') {
        return { state: 'connected' };
      }

      const qrCode = data?.code ?? data?.qrcode?.code ?? null;
      return { state: 'connecting', qrCode };
    } catch (error) {
      this.fail('Falha ao conectar a sessão do WhatsApp', error);
    }
  }

  private toSentMessage(data: EvolutionSendResponse): ProviderSentMessage {
    return {
      messageId: data?.key?.id ?? '',
      timestamp: Number(data?.messageTimestamp) || undefined,
    };
  }

  /** Extrai apenas os dígitos do JID — é o formato que o campo `number` espera. */
  private toNumber(jidOrNumber: string): string {
    return (jidOrNumber ?? '').split('@')[0].replace(/\D/g, '');
  }

  /** Garante o sufixo de JID individual quando recebe só o número. */
  private toJid(jidOrNumber: string): string {
    if (!jidOrNumber) return '';
    return jidOrNumber.includes('@') ? jidOrNumber : `${this.toNumber(jidOrNumber)}@s.whatsapp.net`;
  }

  private statusOf(error: unknown): number | undefined {
    return isAxiosError(error) ? error.response?.status : undefined;
  }

  private messageOf(error: unknown): string {
    if (isAxiosError(error)) {
      const payload = error.response?.data;
      if (payload) {
        const detail =
          (payload as { response?: { message?: unknown } }).response?.message ??
          (payload as { message?: unknown }).message ??
          (payload as { error?: unknown }).error;
        if (detail) return Array.isArray(detail) ? detail.join('; ') : String(detail);
      }
      return error.message;
    }
    return error instanceof Error ? error.message : String(error);
  }

  private fail(context: string, error: unknown): never {
    // Erros já traduzidos para o domínio sobem intactos.
    if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
      throw error;
    }
    const detail = this.messageOf(error);
    this.logger.error(`${context}: ${detail}`);
    throw new InternalServerErrorException(`${context}: ${detail}`);
  }
}
