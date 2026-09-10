/**
 * Tipos do payload da Evolution API v2.3.7.
 *
 * Espelham o que a Evolution realmente envia — conferido no código-fonte
 * (`src/api/integrations/channel/whatsapp/whatsapp.baileys.service.ts` e
 * `src/api/integrations/event/webhook/webhook.controller.ts`). Ficam confinados
 * a esta pasta: acima da camada de provider o resto da aplicação só vê os tipos
 * normalizados.
 */

/** Nomes de evento como chegam no webhook (lowercase-dotted). */
export enum EvolutionEvent {
  APPLICATION_STARTUP = 'application.startup',
  QRCODE_UPDATED = 'qrcode.updated',
  CONNECTION_UPDATE = 'connection.update',
  STATUS_INSTANCE = 'status.instance',
  MESSAGES_SET = 'messages.set',
  MESSAGES_UPSERT = 'messages.upsert',
  MESSAGES_UPDATE = 'messages.update',
  MESSAGES_EDITED = 'messages.edited',
  MESSAGES_DELETE = 'messages.delete',
  SEND_MESSAGE = 'send.message',
  SEND_MESSAGE_UPDATE = 'send.message.update',
  CONTACTS_SET = 'contacts.set',
  CONTACTS_UPSERT = 'contacts.upsert',
  CONTACTS_UPDATE = 'contacts.update',
  CHATS_SET = 'chats.set',
  CHATS_UPSERT = 'chats.upsert',
  CHATS_UPDATE = 'chats.update',
  CHATS_DELETE = 'chats.delete',
  PRESENCE_UPDATE = 'presence.update',
  GROUPS_UPSERT = 'groups.upsert',
  GROUP_UPDATE = 'group.update',
  GROUP_PARTICIPANTS_UPDATE = 'group.participants.update',
  CALL = 'call',
  LABELS_EDIT = 'labels.edit',
  LABELS_ASSOCIATION = 'labels.association',
}

/**
 * Status de entrega. A Evolution manda a string, não o índice
 * (ver `src/utils/renderStatus.ts` no projeto dela).
 */
export enum EvolutionStatus {
  ERROR = 'ERROR',
  PENDING = 'PENDING',
  SERVER_ACK = 'SERVER_ACK',
  DELIVERY_ACK = 'DELIVERY_ACK',
  READ = 'READ',
  PLAYED = 'PLAYED',
  DELETED = 'DELETED',
  EDITED = 'EDITED',
}

/** Envelope do webhook (`webhook.controller.ts:93-103`). */
export type EvolutionWebhookBody<T = unknown> = {
  event: string;
  instance: string;
  data: T;
  sender?: string;
  /** Vem nulo salvo AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true — não usar para autenticar. */
  apikey?: string | null;
  date_time?: string;
  destination?: string;
  server_url?: string;
  /** Presentes apenas em messages.set. */
  isLatest?: boolean;
  progress?: number;
};

export type EvolutionMessageKey = {
  remoteJid: string;
  fromMe: boolean;
  id: string;
  participant?: string;
  remoteJidAlt?: string;
  participantAlt?: string;
};

/** ContextInfo do Baileys — carrega a mensagem citada e as menções. */
export type EvolutionContextInfo = {
  stanzaId?: string;
  participant?: string;
  quotedMessage?: EvolutionMessageContent;
  mentionedJid?: string[];
  expiration?: number;
};

/**
 * Conteúdo da mensagem. A Evolution normaliza `extendedTextMessage` para
 * `conversation` e achata `documentWithCaptionMessage` (`prepareMessage`).
 */
export type EvolutionMessageContent = {
  conversation?: string;
  imageMessage?: EvolutionMediaContent;
  videoMessage?: EvolutionMediaContent & { gifPlayback?: boolean };
  audioMessage?: EvolutionMediaContent & { ptt?: boolean; seconds?: number };
  documentMessage?: EvolutionMediaContent & { fileName?: string; title?: string };
  stickerMessage?: EvolutionMediaContent;
  ptvMessage?: EvolutionMediaContent;
  contactMessage?: { displayName?: string; vcard?: string };
  contactsArrayMessage?: { contacts?: { displayName?: string; vcard?: string }[] };
  locationMessage?: { degreesLatitude?: number; degreesLongitude?: number; name?: string };
  reactionMessage?: { key?: EvolutionMessageKey; text?: string };
  protocolMessage?: { key?: EvolutionMessageKey; type?: string };
  editedMessage?: unknown;
  /** Adicionado pela Evolution quando o webhook está com base64 habilitado. */
  base64?: string;
  /** Adicionado quando a Evolution tem storage S3/MinIO configurado. */
  mediaUrl?: string;
  speechToText?: string;
};

export type EvolutionMediaContent = {
  url?: string;
  mimetype?: string;
  caption?: string;
  fileLength?: string | number;
  fileName?: string;
  seconds?: number;
  height?: number;
  width?: number;
  contextInfo?: EvolutionContextInfo;
};

/** Payload de `messages.upsert` e `send.message` — key aninhado. */
export type EvolutionUpsertData = {
  key: EvolutionMessageKey;
  pushName?: string;
  status?: string;
  message: EvolutionMessageContent;
  contextInfo?: EvolutionContextInfo;
  messageType: string;
  /** Em segundos. */
  messageTimestamp: number;
  instanceId?: string;
  /** Dispositivo de origem: substitui o `deviceType` do whatsapp-web.js. */
  source?: string;
};

/** Payload de `messages.update` — achatado, sem `key` aninhado. */
export type EvolutionUpdateData = {
  keyId: string;
  remoteJid: string;
  fromMe: boolean;
  participant?: string;
  status?: string;
  messageId?: string;
  message?: EvolutionMessageContent;
  pollUpdates?: unknown;
};

/** Payload de `messages.delete`: a própria key mais o status. */
export type EvolutionDeleteData = EvolutionMessageKey & {
  status?: string;
};

/** Payload de `qrcode.updated` — o QR vem num nível extra. */
export type EvolutionQrCodeData = {
  qrcode?: {
    instance?: string;
    pairingCode?: string | null;
    /** String crua do QR: é esta que o front renderiza. */
    code?: string;
    /** Data URL (`data:image/png;base64,...`), não base64 puro. */
    base64?: string;
    count?: number;
  };
  /** Presentes quando o limite de leituras do QR é atingido. */
  message?: string;
  statusCode?: number;
};

export type EvolutionConnectionData = {
  instance?: string;
  state?: 'connecting' | 'open' | 'close' | 'refused';
  statusReason?: number;
  wuid?: string;
  profileName?: string;
  profilePictureUrl?: string;
};

export type EvolutionContactData = {
  remoteJid: string;
  pushName?: string;
  profilePicUrl?: string;
  instanceId?: string;
};

export type EvolutionChatData = {
  remoteJid?: string;
  id?: string;
  unreadCount?: number;
  instanceId?: string;
};

// == Respostas das chamadas HTTP ==

export type EvolutionInstanceCreateResponse = {
  instance?: {
    instanceName?: string;
    instanceId?: string;
    integration?: string;
    status?: string;
  };
  /** Token da instância criada. */
  hash?: string;
  qrcode?: EvolutionQrCodeData['qrcode'];
};

/**
 * Retorno de `GET /instance/connect/:instanceName`. É polimórfico
 * (`instance.controller.ts:309-344`): pode vir o estado, o objeto de QR cru,
 * ou um erro — sempre com HTTP 200.
 */
export type EvolutionConnectResponse = {
  instance?: { instanceName?: string; state?: string; status?: string };
  pairingCode?: string | null;
  code?: string;
  base64?: string;
  count?: number;
  qrcode?: EvolutionQrCodeData['qrcode'];
  error?: boolean;
  message?: string | string[];
};

export type EvolutionConnectionStateResponse = {
  instance?: { instanceName?: string; state?: string };
};

export type EvolutionSendResponse = {
  key?: EvolutionMessageKey;
  message?: EvolutionMessageContent;
  messageTimestamp?: number | string;
  status?: string;
};

export type EvolutionBase64Response = {
  mediaType?: string;
  fileName?: string;
  caption?: string;
  size?: { fileLength?: number | string; height?: number; width?: number };
  mimetype?: string;
  /** Base64 puro, sem o prefixo `data:`. */
  base64?: string;
};
