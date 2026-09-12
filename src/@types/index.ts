import { SupportChatMessages } from '@/support-chats/messages/entities/support-chat-messages.entity';
import { SupportServices } from 'supports/entities/support-services.entity';
import { MessageTypes } from './whatsapp';
export * from './whatsapp';

export interface JwtPayload {
  sub: number;
  id: number;
  type: string;
}

export enum ChannelStatus {
  DISCONNECTED = 1,
  CONNECTING = 2,
  CONNECTED = 3,
  EXPIRED_SESSION = 4,
  DELETED = 5,
}

export type SupportListResponse = {
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
  contact_phone: string;
  status_descricao: string;
  support_status_id: number;
  supportServices: SupportServices[];
};

type FieldsSignature = {
  acl: string;
  bucket: string;
  'X-Amz-Algorithm': string;
  'X-Amz-Credential': string;
  'X-Amz-Date': string;
  key: string;
  Policy: string;
  'X-Amz-Signature': string;
};

export type SignatureResponse = {
  url: string;
  fields: FieldsSignature;
};

export type MessageWithLastMessage = SupportChatMessages & {
  lastMessage?: {
    id: string;
    type: MessageTypes;
    content: string;
  };
};

/**
 * Status de um atendimento, conforme semeado em `support_chat_status`.
 *
 * Os de id 4 e 5 têm `is_final = true`: o `findOrOpen` só reaproveita conversas
 * não finais, então encerrar um atendimento faz a próxima mensagem do contato
 * abrir outro, com protocolo novo.
 */
export enum SupportChatStatusId {
  AGUARDANDO = 1,
  EM_ANDAMENTO = 2,
  EM_FILA = 3,
  FINALIZADO_SEM_RESPOSTA = 4,
  FINALIZADO = 5,
}
