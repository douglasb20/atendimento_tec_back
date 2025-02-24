import { AtendimentosServicosEntity } from 'atendimentos/entities/atendimento-servico.entity';

export interface AtendimentoListResponse {
  id: number;
  clients_id: number;
  contacts_id: number;
  users_id: number;
  data_referencia: string;
  hora_inicio: string;
  hora_fim: string;
  comentario: string;
  tipo_entrada: string;
  esta_pago: number;
  atendimento_status_id: number;
  duration: string;
  cli_nome: string;
  cli_cnpj: string;
  user_nome: string;
  user_email: string;
  contact_nome: string;
  contact_telefone: string;
  status_descricao: string;
  atendimentosServicos: AtendimentosServicosEntity[];
}
