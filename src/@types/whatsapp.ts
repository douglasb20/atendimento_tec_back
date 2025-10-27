export enum DataTypeWhatsapp {
  AUTHENTICATED = 'authenticated',
  AUTHENTICATION_FAILURE = 'auth_failure',
  READY = 'ready',
  MESSAGE_RECEIVED = 'message',
  MESSAGE_CIPHERTEXT = 'message_ciphertext',
  MESSAGE_CREATE = 'message_create',
  MESSAGE_REACTION = 'message_reaction',
  MESSAGE_REVOKED_EVERYONE = 'message_revoke_everyone',
  MESSAGE_REVOKED_ME = 'message_revoke_me',
  MESSAGE_ACK = 'message_ack',
  MESSAGE_EDIT = 'message_edit',
  MEDIA_UPLOADED = 'media_uploaded',
  CONTACT_CHANGED = 'contact_changed',
  GROUP_JOIN = 'group_join',
  GROUP_LEAVE = 'group_leave',
  GROUP_ADMIN_CHANGED = 'group_admin_changed',
  GROUP_MEMBERSHIP_REQUEST = 'group_membership_request',
  GROUP_UPDATE = 'group_update',
  QR_RECEIVED = 'qr',
  LOADING_SCREEN = 'loading_screen',
  DISCONNECTED = 'disconnected',
  STATE_CHANGED = 'change_state',
  BATTERY_CHANGED = 'change_battery',
  REMOTE_SESSION_SAVED = 'remote_session_saved',
  CALL = 'call',
}

export enum MessageTypes {
  TEXT = 'chat',
  AUDIO = 'audio',
  VOICE = 'ptt',
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
  STICKER = 'sticker',
  LOCATION = 'location',
  CONTACT_CARD = 'vcard',
  CONTACT_CARD_MULTI = 'multi_vcard',
  REVOKED = 'revoked',
  ORDER = 'order',
  PRODUCT = 'product',
  PAYMENT = 'payment',
  UNKNOWN = 'unknown',
  GROUP_INVITE = 'groups_v4_invite',
  LIST = 'list',
  LIST_RESPONSE = 'list_response',
  BUTTONS_RESPONSE = 'buttons_response',
  BROADCAST_NOTIFICATION = 'broadcast_notification',
  CALL_LOG = 'call_log',
  CIPHERTEXT = 'ciphertext',
  DEBUG = 'debug',
  E2E_NOTIFICATION = 'e2e_notification',
  GP2 = 'gp2',
  GROUP_NOTIFICATION = 'group_notification',
  HSM = 'hsm',
  INTERACTIVE = 'interactive',
  NATIVE_FLOW = 'native_flow',
  NOTIFICATION = 'notification',
  NOTIFICATION_TEMPLATE = 'notification_template',
  OVERSIZED = 'oversized',
  PROTOCOL = 'protocol',
  REACTION = 'reaction',
  TEMPLATE_BUTTON_REPLY = 'template_button_reply',
  POLL_CREATION = 'poll_creation',
  SCHEDULED_EVENT_CREATION = 'scheduled_event_creation',
}

export enum MessageAck {
  ACK_ERROR = -1,
  ACK_PENDING = 0,
  ACK_SERVER = 1,
  ACK_DEVICE = 2,
  ACK_READ = 3,
  ACK_PLAYED = 4,
}

export type MessageId = {
  fromMe: boolean;
  remote: string;
  id: string;
  _serialized: string;
};

export type InviteV4Data = {
  inviteCode: string;
  inviteCodeExp: number;
  groupId: string;
  groupName?: string;
  fromId: string;
  toId: string;
};

export type MessageMedia = {
  /** MIME type of the attachment */
  mimetype: string;
  /** Base64-encoded data of the file */
  data: string;
  /** Document file name. Value can be null */
  filename?: string | null;
  /** Document file size in bytes. Value can be null. */
  filesize?: number | null;
};

export type MessageSendOptions = {
  /** Show links preview. Has no effect on multi-device accounts. */
  linkPreview?: boolean;
  /** Send audio as voice message with a generated waveform */
  sendAudioAsVoice?: boolean;
  /** Send video as gif */
  sendVideoAsGif?: boolean;
  /** Send media as sticker */
  sendMediaAsSticker?: boolean;
  /** Send media as document */
  sendMediaAsDocument?: boolean;
  /** Send media as quality HD */
  sendMediaAsHd?: boolean;
  /** Send photo/video as a view once message */
  isViewOnce?: boolean;
  /** Automatically parse vCards and send them as contacts */
  parseVCards?: boolean;
  /** Image or videos caption */
  caption?: string;
  /** Id of the message that is being quoted (or replied to) */
  quotedMessageId?: string;
  /** User IDs to mention in the message */
  mentions?: string[];
  /** An array of object that handle group mentions */
  groupMentions?: {
    /** The name of a group to mention (can be custom) */
    subject: string;
    /** The group ID, e.g.: 'XXXXXXXXXX@g.us' */
    id: string;
  }[];
  /** Send 'seen' status */
  sendSeen?: boolean;
  /** Bot Wid when doing a bot mention like @Meta AI */
  invokedBotWid?: string;
  /** Media to be sent */
  media?: MessageMedia;
  /** Extra options */
  extra?: any;
  /** Sticker name, if sendMediaAsSticker is true */
  stickerName?: string;
  /** Sticker author, if sendMediaAsSticker is true */
  stickerAuthor?: string;
  /** Sticker categories, if sendMediaAsSticker is true */
  stickerCategories?: string[];
  /** Should the bot send a quoted message without the quoted message if it fails to get the quote?
   * @default true (enabled) */
  ignoreQuoteErrors?: boolean;
  /**
   * Should the bot wait for the message send result?
   * @default false
   */
  waitUntilMsgSent?: boolean;
};

export type Message = {
  /** ACK status for the message */
  ack: MessageAck;
  /** If the message was sent to a group, this field will contain the user that sent the message. */
  author?: string;
  /** String that represents from which device type the message was sent */
  deviceType: string;
  /** Message content */
  body: string;
  /** Indicates if the message was a broadcast */
  broadcast: boolean;
  /** Indicates if the message was a status update */
  isStatus: boolean;
  /** Indicates if the message is a Gif */
  isGif: boolean;
  /** Indicates if the message will disappear after it expires */
  isEphemeral: boolean;
  /** ID for the Chat that this message was sent to, except if the message was sent by the current user */
  from: string;
  /** Indicates if the message was sent by the current user */
  fromMe: boolean;
  /** Indicates if the message has media available for download */
  hasMedia: boolean;
  /** Indicates if the message was sent as a reply to another message */
  hasQuotedMsg: boolean;
  /** Indicates whether there are reactions to the message */
  hasReaction: boolean;
  /** Indicates the duration of the message in seconds */
  duration: string;
  /** ID that represents the message */
  id: MessageId;
  /** Indicates if the message was forwarded */
  isForwarded: boolean;
  /**
   * Indicates how many times the message was forwarded.
   * The maximum value is 127.
   */
  forwardingScore: number;
  /** Indicates if the message was starred */
  isStarred: boolean;
  /** Location information contained in the message, if the message is type "location" */
  location: Location;
  /** List of vCards contained in the message */
  vCards: string[];
  /** Invite v4 info */
  inviteV4?: InviteV4Data;
  /** MediaKey that represents the sticker 'ID' */
  mediaKey?: string;
  /** Indicates the mentions in the message body. */
  mentionedIds: string[];
  /** Indicates whether there are group mentions in the message body */
  groupMentions: {
    groupSubject: string;
    groupJid: string;
  }[];
  /** Unix timestamp for when the message was created */
  timestamp: number;
  /**
   * ID for who this message is for.
   * If the message is sent by the current user, it will be the Chat to which the message is being sent.
   * If the message is sent by another user, it will be the ID for the current user.
   */
  to: string;
  /** Message type */
  type: MessageTypes;
  /** Links included in the message. */
  links: Array<{
    link: string;
    isSuspicious: boolean;
  }>;
  /** Order ID */
  orderId: string;
  /** title */
  title?: string;
  /** description*/
  description?: string;
  /** Business Owner JID */
  businessOwnerJid?: string;
  /** Product JID */
  productId?: string;
  /** Last edit time */
  latestEditSenderTimestampMs?: number;
  /** Last edit message author */
  latestEditMsgKey?: MessageId;
  /**
   * Protocol message key.
   * Can be used to retrieve the ID of an original message that was revoked.
   */
  protocolMessageKey?: MessageId;
  /** Message buttons */
  dynamicReplyButtons?: object;
  /** Selected button ID */
  selectedButtonId?: string;
  /** Selected list row ID */
  selectedRowId?: string;
  /** Returns message in a raw format */
  rawData: object;
  pollName: string;
  /** Avaiaible poll voting options */
  pollOptions: string[];
  /** False for a single choice poll, true for a multiple choice poll */
  allowMultipleAnswers: boolean;
  /** The start time of the event in timestamp (10 digits) */
  eventStartTime: number;
  /** The end time of the event in timestamp (10 digits) */
  eventEndTime?: number;
  /** The event description */
  eventDescription?: string;
  /** The location of the event */
  eventLocation?: {
    degreesLatitude: number;
    degreesLongitude: number;
    name: string;
  };
  /** WhatsApp call link (video call or voice call) */
  eventJoinLink?: string;
  /** Indicates if an event should be sent as an already canceled */
  isEventCaneled: boolean;
  /** The custom message secret, can be used as an event ID */
  messageSecret?: Array<number>;
};

type ResultResponse = {
  success: boolean;
};

export type ErrorResponse = ResultResponse & {
  error: string;
};
export type SessionStartResponse = ResultResponse & {
  message: string;
};

export type QrCodeResponse = ResultResponse & {
  qr: string;
  message?: string;
};

export type WhatsappWebhookPayload<T = any> = {
  dataType: DataTypeWhatsapp;
  data: T;
  sessionId: string;
};
