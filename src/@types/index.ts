import { AtendimentosServicosEntity } from 'atendimentos/entities/atendimento-servico.entity';

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
  CALL = 'call'
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

export type AtendimentoListResponse = {
  id: number;
  client_id: number;
  contact_id: number;
  user_id: number;
  data_referencia: string;
  hora_inicio: string;
  hora_fim: string;
  comentario: string;
  tipo_entrada: string;
  esta_pago: number;
  duration: string;
  cli_nome: string;
  cli_cnpj: string;
  user_nome: string;
  user_email: string;
  contact_nome: string;
  contact_telefone: string;
  status_descricao: string;
  atendimento_status_id: number;
  atendimentosServicos: AtendimentosServicosEntity[];
};

type ResultResponse = {
  success: boolean;
}

export type ErrorResponse = ResultResponse & {
  error: string;
}
export type SessionStartResponse = ResultResponse & {
  message: string;
};

export type QrCodeResponse = ResultResponse & {
  qr: string;
}

export type WhatsappWebhookPayload = {
  dataType: DataTypeWhatsapp;
  data: any;
  sessionId: string;
};