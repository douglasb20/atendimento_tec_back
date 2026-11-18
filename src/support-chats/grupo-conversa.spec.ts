import { SupportChatStatusId } from '@/@types';
import { comGrupo, grupoDaConversa } from './grupo-conversa';

const conversa = (dados: Partial<{ support_chat_status_id: number; paused_at: Date | null; pos_atendimento_ativo: boolean }>) => ({
  support_chat_status_id: SupportChatStatusId.AGUARDANDO,
  paused_at: null,
  pos_atendimento_ativo: false,
  ...dados,
});

describe('grupoDaConversa (mesma regra das abas do portal)', () => {
  it('pós-atendimento ativo vai para o chatbot em qualquer status', () => {
    expect(grupoDaConversa(conversa({ pos_atendimento_ativo: true, support_chat_status_id: SupportChatStatusId.FINALIZADO }))).toBe('chatbot');
    expect(grupoDaConversa(conversa({ pos_atendimento_ativo: true, support_chat_status_id: SupportChatStatusId.EM_ANDAMENTO }))).toBe('chatbot');
  });

  it('em andamento pausado vai para pausa; sem pausa, em atendimento', () => {
    expect(grupoDaConversa(conversa({ support_chat_status_id: SupportChatStatusId.EM_ANDAMENTO, paused_at: new Date() }))).toBe('pausa');
    expect(grupoDaConversa(conversa({ support_chat_status_id: SupportChatStatusId.EM_ANDAMENTO }))).toBe('em_atendimento');
  });

  it('em fila do chatbot vai para chatbot; aguardando vai para espera', () => {
    expect(grupoDaConversa(conversa({ support_chat_status_id: SupportChatStatusId.EM_FILA }))).toBe('chatbot');
    expect(grupoDaConversa(conversa({ support_chat_status_id: SupportChatStatusId.AGUARDANDO }))).toBe('espera');
  });

  it('comGrupo devolve a conversa com o campo, sem perder os outros', () => {
    const resultado = comGrupo({ ...conversa({ support_chat_status_id: SupportChatStatusId.EM_FILA }), id: 9 });
    expect(resultado).toMatchObject({ id: 9, grupo: 'chatbot' });
  });

  it('comGrupo tolera nulo (conversa não encontrada)', () => {
    expect(comGrupo(null)).toBeNull();
  });
});
