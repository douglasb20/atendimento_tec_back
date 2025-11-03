import { SupportServices } from 'supports/entities/support-services.entity';
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
}

export type SignatureResponse = {
  url: string;
  fields: FieldsSignature;
}