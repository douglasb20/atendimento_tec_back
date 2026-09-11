import {
  DataTypeWhatsapp,
  MessageAck,
  MessageData,
  MessageTypes,
  Reaction,
  WhatsappWebhookPayload,
} from '@types';
import {
  EvolutionChatData,
  EvolutionConnectionData,
  EvolutionContextInfo,
  EvolutionDeleteData,
  EvolutionEvent,
  EvolutionMediaContent,
  EvolutionMessageContent,
  EvolutionQrCodeData,
  EvolutionStatus,
  EvolutionUpdateData,
  EvolutionUpsertData,
  EvolutionWebhookBody,
} from './evolution.types';

/**
 * Traduz o formato da Evolution API (Baileys) para o vocabulário interno.
 *
 * O objetivo é que nada acima da camada de provider precise conhecer a
 * Evolution: os handlers de `SupportChatsService` e o `MessagesService`
 * continuam recebendo `MessageData`/`Reaction` como antes.
 */

/** Tipos Baileys → `MessageTypes` interno. */
const MESSAGE_TYPE_MAP: Record<string, MessageTypes> = {
  conversation: MessageTypes.TEXT,
  extendedTextMessage: MessageTypes.TEXT,
  imageMessage: MessageTypes.IMAGE,
  videoMessage: MessageTypes.VIDEO,
  ptvMessage: MessageTypes.VIDEO,
  audioMessage: MessageTypes.AUDIO,
  documentMessage: MessageTypes.DOCUMENT,
  documentWithCaptionMessage: MessageTypes.DOCUMENT,
  stickerMessage: MessageTypes.STICKER,
  contactMessage: MessageTypes.CONTACT_CARD,
  contactsArrayMessage: MessageTypes.CONTACT_CARD_MULTI,
  locationMessage: MessageTypes.LOCATION,
  reactionMessage: MessageTypes.REACTION,
  protocolMessage: MessageTypes.PROTOCOL,
  pollCreationMessage: MessageTypes.POLL_CREATION,
  pollUpdateMessage: MessageTypes.POLL_CREATION,
  templateMessage: MessageTypes.TEMPLATE_BUTTON_REPLY,
  buttonsResponseMessage: MessageTypes.BUTTONS_RESPONSE,
  listResponseMessage: MessageTypes.LIST_RESPONSE,
  editedMessage: MessageTypes.TEXT,
};

/** Status textual da Evolution → escala numérica de ack usada no banco. */
const STATUS_ACK_MAP: Record<string, MessageAck> = {
  [EvolutionStatus.ERROR]: MessageAck.ACK_ERROR,
  [EvolutionStatus.PENDING]: MessageAck.ACK_PENDING,
  [EvolutionStatus.SERVER_ACK]: MessageAck.ACK_SERVER,
  [EvolutionStatus.DELIVERY_ACK]: MessageAck.ACK_DEVICE,
  [EvolutionStatus.READ]: MessageAck.ACK_READ,
  [EvolutionStatus.PLAYED]: MessageAck.ACK_PLAYED,
};

const MEDIA_KEYS: (keyof EvolutionMessageContent)[] = [
  'imageMessage',
  'videoMessage',
  'audioMessage',
  'documentMessage',
  'stickerMessage',
  'ptvMessage',
];

export class EvolutionMapper {
  /** Nome do evento da Evolution → tipo interno. Null descarta o evento. */
  static mapEventType(event: string): DataTypeWhatsapp | null {
    switch (event) {
      case EvolutionEvent.MESSAGES_UPSERT:
      case EvolutionEvent.SEND_MESSAGE:
        return DataTypeWhatsapp.MESSAGE_CREATE;
      case EvolutionEvent.MESSAGES_UPDATE:
      case EvolutionEvent.SEND_MESSAGE_UPDATE:
        return DataTypeWhatsapp.MESSAGE_ACK;
      case EvolutionEvent.MESSAGES_EDITED:
        return DataTypeWhatsapp.MESSAGE_EDIT;
      case EvolutionEvent.MESSAGES_DELETE:
        return DataTypeWhatsapp.MESSAGE_REVOKED_EVERYONE;
      case EvolutionEvent.QRCODE_UPDATED:
        return DataTypeWhatsapp.QR_RECEIVED;
      case EvolutionEvent.CONTACTS_UPDATE:
      case EvolutionEvent.CONTACTS_UPSERT:
        return DataTypeWhatsapp.CONTACT_CHANGED;
      case EvolutionEvent.CHATS_UPDATE:
        return DataTypeWhatsapp.UNREAD_COUNT;
      case EvolutionEvent.CONNECTION_UPDATE:
        // Resolvido em mapConnectionState: o `state` decide entre ready e disconnected.
        return DataTypeWhatsapp.STATE_CHANGED;
      default:
        return null;
    }
  }

  /**
   * `connection.update` cobre vários estados; converte para o tipo interno
   * correspondente. Retorna null para estados intermediários sem interesse.
   */
  static mapConnectionState(data: EvolutionConnectionData): DataTypeWhatsapp | null {
    switch (data?.state) {
      case 'open':
        return DataTypeWhatsapp.READY;
      case 'close':
      case 'refused':
        return DataTypeWhatsapp.DISCONNECTED;
      case 'connecting':
        return null;
      default:
        return null;
    }
  }

  /** JID do chat, para agrupar jobs por conversa. Aceita os dois shapes. */
  static extractRemoteJid(event: string, data: unknown): string | null {
    if (!data) return null;

    switch (event) {
      case EvolutionEvent.MESSAGES_UPSERT:
      case EvolutionEvent.SEND_MESSAGE:
        return (data as EvolutionUpsertData).key?.remoteJid ?? null;
      case EvolutionEvent.MESSAGES_UPDATE:
      case EvolutionEvent.SEND_MESSAGE_UPDATE:
        return (data as EvolutionUpdateData).remoteJid ?? null;
      case EvolutionEvent.MESSAGES_DELETE: {
        // A revogação chega ora achatada, ora com a chave aninhada em `key`,
        // conforme a origem (celular do atendente ou a própria API).
        const del = data as EvolutionDeleteData & { key?: { remoteJid?: string } };
        return del.remoteJid ?? del.key?.remoteJid ?? null;
      }
      case EvolutionEvent.CHATS_UPDATE: {
        const chat = Array.isArray(data) ? data[0] : (data as EvolutionChatData);
        return chat?.remoteJid ?? chat?.id ?? null;
      }
      default:
        return null;
    }
  }

  /**
   * `messages.upsert` / `send.message` → `MessageData`.
   *
   * Mantém a forma que `MessagesService` já consome, incluindo o `_data` que no
   * whatsapp-web.js carregava os dados da mensagem citada.
   */
  static mapUpsert(data: EvolutionUpsertData): MessageData {
    const { key, message, messageType, messageTimestamp, pushName, status, source } = data;
    const contextInfo = data.contextInfo ?? this.extractContextInfo(message);
    const mediaContent = this.extractMediaContent(message);
    const type = this.mapMessageType(messageType, message);
    const remoteJid = key?.remoteJid ?? '';

    return {
      ack: this.mapStatusToAck(status, key?.fromMe ?? false),
      author: key?.participant,
      deviceType: source ?? 'unknown',
      body: this.extractBody(message, type, mediaContent),
      isStatus: remoteJid === 'status@broadcast',
      isGif: Boolean(message?.videoMessage?.gifPlayback),
      isEphemeral: Boolean(contextInfo?.expiration),
      from: key?.fromMe ? '' : remoteJid,
      fromMe: key?.fromMe ?? false,
      hasMedia: Boolean(mediaContent),
      hasQuotedMsg: Boolean(contextInfo?.stanzaId),
      hasReaction: false,
      duration: String(message?.audioMessage?.seconds ?? mediaContent?.seconds ?? ''),
      id: {
        fromMe: key?.fromMe ?? false,
        remote: remoteJid,
        id: key?.id ?? '',
        _serialized: `${key?.fromMe ? 'true' : 'false'}_${remoteJid}_${key?.id ?? ''}`,
      },
      isForwarded: false,
      forwardingScore: 0,
      isStarred: false,
      location: undefined,
      vCards: this.extractVCards(message),
      mentionedIds: contextInfo?.mentionedJid ?? [],
      groupMentions: [],
      timestamp: Number(messageTimestamp) || Math.floor(Date.now() / 1000),
      to: key?.fromMe ? remoteJid : '',
      type,
      links: [],
      orderId: undefined,
      rawData: data as unknown as object,
      pollName: undefined,
      pollOptions: undefined,
      allowMultipleAnswers: undefined,
      _data: {
        notifyName: pushName ?? '',
        quotedStanzaID: contextInfo?.stanzaId,
        quotedParticipant: contextInfo?.participant,
        quotedRemoteJid: remoteJid,
        quotedMsg: contextInfo?.quotedMessage
          ? { body: this.extractQuotedBody(contextInfo.quotedMessage) }
          : undefined,
      },
    } as MessageData;
  }

  /**
   * `messages.update` → `MessageData` parcial, o suficiente para o fluxo de ack
   * (que consome apenas `id.id` e `ack`).
   */
  static mapUpdate(data: EvolutionUpdateData): MessageData {
    const remoteJid = data.remoteJid ?? '';

    return {
      ack: this.mapStatusToAck(data.status, data.fromMe ?? false, MessageAck.ACK_SERVER),
      deviceType: 'unknown',
      body: '',
      isStatus: false,
      isGif: false,
      isEphemeral: false,
      from: data.fromMe ? '' : remoteJid,
      fromMe: data.fromMe ?? false,
      hasMedia: false,
      hasQuotedMsg: false,
      hasReaction: false,
      duration: '',
      id: {
        fromMe: data.fromMe ?? false,
        remote: remoteJid,
        id: data.keyId ?? '',
        _serialized: `${data.fromMe ? 'true' : 'false'}_${remoteJid}_${data.keyId ?? ''}`,
      },
      isForwarded: false,
      forwardingScore: 0,
      isStarred: false,
      vCards: [],
      mentionedIds: [],
      groupMentions: [],
      timestamp: Math.floor(Date.now() / 1000),
      to: data.fromMe ? remoteJid : '',
      type: MessageTypes.TEXT,
      links: [],
      rawData: data as unknown as object,
      _data: { notifyName: '' },
    } as MessageData;
  }

  /** Mensagem editada: o texto novo vem no próprio conteúdo. */
  static mapEdited(data: EvolutionUpsertData): MessageData {
    return this.mapUpsert(data);
  }

  /**
   * `messages.delete` → `MessageData` com `protocolMessageKey`, que é onde o
   * fluxo de revogação busca o id da mensagem original.
   */
  static mapDeleted(data: EvolutionDeleteData): MessageData {
    // Duas formas convivem aqui: achatada (revogação vinda do aparelho) e com
    // `key` aninhado (revogação pedida pela API). No aninhado, `data.id` é o id
    // interno da Evolution — a chave do WhatsApp está em `key.id`.
    const chave = (data as EvolutionDeleteData & { key?: EvolutionDeleteData }).key;
    const remoteJid = data.remoteJid ?? chave?.remoteJid ?? '';
    const fromMe = data.fromMe ?? chave?.fromMe ?? false;
    const messageId = chave?.id ?? data.id ?? '';

    data = { ...data, remoteJid, fromMe, id: messageId };

    return {
      ack: MessageAck.ACK_ERROR,
      deviceType: 'unknown',
      body: '',
      isStatus: false,
      isGif: false,
      isEphemeral: false,
      from: data.fromMe ? '' : remoteJid,
      fromMe: data.fromMe ?? false,
      hasMedia: false,
      hasQuotedMsg: false,
      hasReaction: false,
      duration: '',
      id: {
        fromMe: data.fromMe ?? false,
        remote: remoteJid,
        id: data.id ?? '',
        _serialized: `${data.fromMe ? 'true' : 'false'}_${remoteJid}_${data.id ?? ''}`,
      },
      protocolMessageKey: {
        fromMe: data.fromMe ?? false,
        remote: remoteJid,
        id: data.id ?? '',
        _serialized: `${data.fromMe ? 'true' : 'false'}_${remoteJid}_${data.id ?? ''}`,
      },
      isForwarded: false,
      forwardingScore: 0,
      isStarred: false,
      vCards: [],
      mentionedIds: [],
      groupMentions: [],
      timestamp: Math.floor(Date.now() / 1000),
      to: data.fromMe ? remoteJid : '',
      type: MessageTypes.REVOKED,
      links: [],
      rawData: data as unknown as object,
      _data: { notifyName: '' },
    } as MessageData;
  }

  /** Reação: na Evolution chega como uma mensagem com `reactionMessage`. */
  static mapReaction(data: EvolutionUpsertData): Reaction | null {
    const reactionMessage = data.message?.reactionMessage;
    if (!reactionMessage?.key) return null;

    const targetKey = reactionMessage.key;
    const remoteJid = targetKey.remoteJid ?? data.key?.remoteJid ?? '';

    return {
      id: {
        fromMe: data.key?.fromMe ?? false,
        remote: data.key?.remoteJid ?? '',
        id: data.key?.id ?? '',
        _serialized: `${data.key?.fromMe ? 'true' : 'false'}_${data.key?.remoteJid}_${data.key?.id}`,
      },
      orphan: 0,
      timestamp: Number(data.messageTimestamp) || Math.floor(Date.now() / 1000),
      reaction: reactionMessage.text ?? '',
      read: false,
      msgId: {
        fromMe: targetKey.fromMe ?? false,
        remote: remoteJid,
        id: targetKey.id ?? '',
        _serialized: `${targetKey.fromMe ? 'true' : 'false'}_${remoteJid}_${targetKey.id ?? ''}`,
      },
      senderId: data.key?.participant ?? remoteJid,
    } as Reaction;
  }

  /** QR code: a Evolution aninha em `data.qrcode`. Devolve a string crua. */
  static mapQrCode(data: EvolutionQrCodeData): string | null {
    return data?.qrcode?.code ?? null;
  }

  /** Número do dono da sessão, apenas dígitos. */
  static extractPhoneFromWuid(wuid?: string): string | null {
    if (!wuid) return null;
    const digits = wuid.split('@')[0]?.replace(/\D/g, '');
    return digits || null;
  }

  /** Envelope da Evolution → envelope interno. */
  static toInternalPayload<T = unknown>(
    body: EvolutionWebhookBody,
    dataType: DataTypeWhatsapp,
    data: T,
  ): WhatsappWebhookPayload<T> {
    return { dataType, data, sessionId: body.instance };
  }

  // == Auxiliares ==

  /**
   * Resolve o tipo interno. Diferencia áudio de voz (`ptt`) e, quando o
   * `messageType` é desconhecido, cai em UNKNOWN em vez de deixar undefined —
   * o switch de `saveIncoming` não tem branch default.
   */
  static mapMessageType(messageType: string, message?: EvolutionMessageContent): MessageTypes {
    if (message?.audioMessage) {
      return message.audioMessage.ptt ? MessageTypes.VOICE : MessageTypes.AUDIO;
    }
    if (message?.contactsArrayMessage) return MessageTypes.CONTACT_CARD_MULTI;

    return MESSAGE_TYPE_MAP[messageType] ?? MessageTypes.UNKNOWN;
  }

  /**
   * Status → ack. `fallback` cobre a divergência da Evolution: em `upsert`,
   * mensagem recebida sem status assume DELIVERY_ACK; em `update`, SERVER_ACK.
   */
  static mapStatusToAck(
    status: string | undefined,
    fromMe: boolean,
    fallback?: MessageAck,
  ): MessageAck {
    if (status && STATUS_ACK_MAP[status] !== undefined) {
      return STATUS_ACK_MAP[status];
    }
    if (fallback !== undefined) return fallback;
    return fromMe ? MessageAck.ACK_SERVER : MessageAck.ACK_DEVICE;
  }

  /** Primeiro nó de mídia presente no conteúdo. */
  private static extractMediaContent(
    message?: EvolutionMessageContent,
  ): EvolutionMediaContent | null {
    if (!message) return null;

    for (const mediaKey of MEDIA_KEYS) {
      const content = message[mediaKey] as EvolutionMediaContent | undefined;
      if (content) return content;
    }
    return null;
  }

  /** ContextInfo pode vir no topo ou dentro do nó de mídia. */
  private static extractContextInfo(
    message?: EvolutionMessageContent,
  ): EvolutionContextInfo | undefined {
    const mediaContent = this.extractMediaContent(message);
    return mediaContent?.contextInfo;
  }

  /**
   * Texto exibido da mensagem. A Evolution já normaliza `extendedTextMessage`
   * para `conversation`, então o texto vem sempre daí; mídia usa a legenda.
   */
  private static extractBody(
    message: EvolutionMessageContent | undefined,
    type: MessageTypes,
    mediaContent: EvolutionMediaContent | null,
  ): string {
    if (!message) return '';

    if (message.conversation) return message.conversation;
    if (type === MessageTypes.CONTACT_CARD || type === MessageTypes.CONTACT_CARD_MULTI) {
      return JSON.stringify(this.extractVCards(message));
    }
    if (message.locationMessage) {
      const { degreesLatitude, degreesLongitude, name } = message.locationMessage;
      return name ?? `${degreesLatitude ?? ''},${degreesLongitude ?? ''}`;
    }
    if (message.speechToText) return message.speechToText;

    return mediaContent?.caption ?? '';
  }

  private static extractQuotedBody(quoted: EvolutionMessageContent): string {
    if (quoted.conversation) return quoted.conversation;
    const media = this.extractMediaContent(quoted);
    return media?.caption ?? '';
  }

  private static extractVCards(message?: EvolutionMessageContent): string[] {
    if (message?.contactsArrayMessage?.contacts?.length) {
      return message.contactsArrayMessage.contacts
        .map((contact) => contact.vcard)
        .filter((vcard): vcard is string => Boolean(vcard));
    }
    if (message?.contactMessage?.vcard) {
      return [message.contactMessage.vcard];
    }
    return [];
  }
}
