import type { EntityManager } from 'typeorm';

export function permiteAutomacaoContato(contato?: { ignore_support?: boolean; automation_disabled?: boolean } | null): boolean {
  return contato != null && !contato.ignore_support && !contato.automation_disabled;
}

/** Interrompe trabalhos persistidos, sem encerrar uma conversa humana ou abrir protocolo. */
export async function interromperAutomacoesContato(contactId: number, manager: EntityManager): Promise<number[]> {
  // Mesma ordem do motor: primeiro conversa, depois execução.
  await manager.query('SELECT id FROM support_chats WHERE contact_id = $1 ORDER BY id FOR UPDATE', [contactId]);
  const [conversas] = await manager.query(`UPDATE support_chats SET
    support_chat_status_id = CASE WHEN support_chat_status_id = 3 AND user_id IS NULL THEN 1 ELSE support_chat_status_id END,
    pos_atendimento_ativo = false, updated_at = NOW()
    WHERE contact_id = $1 AND ((support_chat_status_id = 3 AND user_id IS NULL) OR pos_atendimento_ativo = true)
    RETURNING id`, [contactId]);
  await manager.query(`UPDATE chatbot_flow_executions SET status = 'aborted', waiting_for = NULL,
    finished_at = NOW(), updated_at = NOW(), version = version + 1
    WHERE contact_id = $1 AND status IN ('running', 'suspended')`, [contactId]);
  return conversas.map((conversa: { id: number }) => Number(conversa.id));
}
