import { MessageMedia } from '@types';

/**
 * Contrato que todo provider de WhatsApp deve cumprir.
 *
 * O vocabulário aqui é do domínio da aplicação, não de nenhum provider
 * específico: quem implementa traduz para os endpoints e formatos próprios.
 * Hoje há uma implementação (Evolution API); a API oficial da Meta entra
 * futuramente sem alterar nada acima desta camada.
 */
export interface WhatsappProvider {
  /** Nome do provider, correspondendo ao slug em `integration_providers`. */
  readonly slug: string;

  /**
   * Garante que a sessão exista e esteja conectando/conectada.
   * Cria a sessão no provider quando ainda não existe.
   */
  requestConnection(session: ProviderSessionRef): Promise<ProviderConnectionResult>;

  /** Devolve o QR code corrente, ou null quando já conectado. */
  requestQrCode(session: ProviderSessionRef): Promise<string | null>;

  /** Encerra a sessão sem apagá-la no provider. */
  requestDisconnection(session: ProviderSessionRef): Promise<void>;

  /** Dados da conta conectada — usado para descobrir o número do canal. */
  getClientInfo(session: ProviderSessionRef): Promise<ProviderClientInfo>;

  getProfilePicUrl(session: ProviderSessionRef, remoteJid: string): Promise<string>;

  /** Número em formato apenas dígitos, sem o sufixo do JID. */
  getFormattedNumber(session: ProviderSessionRef, remoteJid: string): Promise<string>;

  downloadMedia(
    session: ProviderSessionRef,
    messageId: string,
    chatId: string,
  ): Promise<MessageMedia>;

  sendMessage(
    session: ProviderSessionRef,
    to: string,
    message: string,
  ): Promise<ProviderSentMessage>;

  replyMessage(
    session: ProviderSessionRef,
    chatId: string,
    messageId: string,
    message: string,
  ): Promise<ProviderSentMessage>;

  sendReaction(
    session: ProviderSessionRef,
    chatId: string,
    messageId: string,
    reaction: string,
  ): Promise<void>;

  /**
   * Envia mídia a partir de uma URL pública ou base64.
   * Preferir URL: evita trafegar bytes e não tem limite de tamanho de corpo.
   */
  sendMedia(session: ProviderSessionRef, media: ProviderMediaPayload): Promise<ProviderSentMessage>;
}

/** Identifica a sessão no provider e traz o que é necessário para autenticar. */
export type ProviderSessionRef = {
  /** `session_id` do canal — na Evolution corresponde ao `instanceName`. */
  sessionId: string;
  /** Token da própria instância, quando o provider oferecer um. */
  instanceToken?: string | null;
  /** Id do canal, usado para persistir dados devolvidos pelo provider. */
  channelId?: number;
};

export type ProviderConnectionState = 'connecting' | 'connected' | 'disconnected' | 'refused';

export type ProviderConnectionResult = {
  state: ProviderConnectionState;
  /** String crua do QR, quando o provider já a devolve no connect. */
  qrCode?: string | null;
  /** Token da instância recém-criada, a ser persistido pelo chamador. */
  instanceToken?: string | null;
};

export type ProviderClientInfo = {
  /** Número do dono da sessão, apenas dígitos. */
  phoneNumber: string | null;
  pushName?: string | null;
  profilePicUrl?: string | null;
};

export type ProviderMediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker';

export type ProviderMediaPayload = {
  to: string;
  mediaType: ProviderMediaType;
  /** URL pública (preferencial) ou base64 puro. */
  media: string;
  mimetype?: string;
  caption?: string;
  fileName?: string;
  /** Quando presente, a mídia é enviada como resposta a esta mensagem. */
  quotedMessageId?: string;
};

export type ProviderSentMessage = {
  /** Id da mensagem no WhatsApp, para casar com os eventos de ack. */
  messageId: string;
  timestamp?: number;
};

/** Token de injeção para a implementação resolvida pela factory. */
export const WHATSAPP_PROVIDER = 'WHATSAPP_PROVIDER';
