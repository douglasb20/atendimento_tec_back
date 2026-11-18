import { SupportChatStatusId } from '@/@types';

/** Aba da lista de conversas em que a conversa aparece (portal e app). */
export type GrupoConversa = 'espera' | 'em_atendimento' | 'pausa' | 'chatbot';

type CamposDoGrupo = {
  support_chat_status_id: number;
  paused_at?: Date | string | null;
  pos_atendimento_ativo?: boolean;
};

/**
 * A que grupo uma conversa pertence. Antes vivia só no portal
 * (`FiltroAtendimentos.tsx`); veio para o back para portal e app usarem a mesma
 * regra (`MOBILE.md`: regra de negócio fica no back).
 *
 * Decidido pelo id do status, nunca pela relação `supportChatStatus`: ela não
 * vem nos payloads de webhook. Com o chatbot desligado o grupo continua
 * `chatbot`; quem esconde a aba é a tela, como o portal sempre fez.
 */
export function grupoDaConversa(chat: CamposDoGrupo): GrupoConversa {
  if (chat.pos_atendimento_ativo) return 'chatbot';
  if (chat.support_chat_status_id === SupportChatStatusId.EM_ANDAMENTO) {
    // Pausar preserva status e dono; só muda o grupo.
    return chat.paused_at ? 'pausa' : 'em_atendimento';
  }
  return chat.support_chat_status_id === SupportChatStatusId.EM_FILA ? 'chatbot' : 'espera';
}

/** A conversa com `grupo`, para tudo o que sai para portal e app. */
export function comGrupo<T extends CamposDoGrupo>(chat: T): T & { grupo: GrupoConversa };
export function comGrupo(chat: null | undefined): null;
export function comGrupo<T extends CamposDoGrupo>(chat: T | null | undefined) {
  if (!chat) return null;
  return Object.assign(chat, { grupo: grupoDaConversa(chat) });
}
