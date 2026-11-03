import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { ChatbotsDoCanalService } from './chatbots-do-canal.service';
import { CreateChatbotDto } from '@/chatbots/dto/create-chatbot.dto';
import { CreateOrChannelDto } from './dto/create-or-channel.dto';

describe('Escolha dos fluxos pelo canal', () => {
  function preparar(tipo = 'entrada', publicado: number | null = null, setor = 10) {
    const consulta = jest.fn(async (sql: string) => {
      if (sql.includes('FROM chatbots WHERE')) return [{ id: 7, type: tipo, deleted_at: null, current_published_version_id: publicado }];
      if (sql.includes('FROM chatbot_flow_versions')) return [{ graph: { nodes: [{ type: 'business_hours', data: { department_id: 10 } }] } }];
      if (sql.includes('SELECT department_id')) return [{ department_id: setor }];
      return [];
    });
    const servico = new ChatbotsDoCanalService({ query: consulta } as never);
    return { servico, consulta, manager: { query: consulta } as never };
  }

  it('cria chatbot sem exigir um canal e recusa vínculos pelo formulário antigo', () => {
    expect(validateSync(plainToInstance(CreateChatbotDto, { name: 'Entrada', type: 'entrada' }))).toHaveLength(0);
    expect(validateSync(plainToInstance(CreateChatbotDto, { name: 'Entrada', type: 'entrada', channel_ids: [1] })))
      .toEqual(expect.arrayContaining([expect.objectContaining({ property: 'channel_ids' })]));
  });

  it('não altera os vínculos quando os campos são omitidos', async () => {
    const { servico, consulta, manager } = preparar();
    await servico.salvar(1, { name: 'Suporte' }, manager);
    expect(consulta).not.toHaveBeenCalled();
  });

  it('limpa apenas o tipo explicitamente removido', async () => {
    const { servico, consulta, manager } = preparar();
    await servico.salvar(1, { name: 'Suporte', chatbot_entrada_id: null }, manager);
    expect(consulta).toHaveBeenCalledTimes(1);
    expect(consulta).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM channel_x_chatbot'), [1, 'entrada']);
  });

  it('permite associar um rascunho sem exigir publicação antecipada', async () => {
    const { servico, consulta, manager } = preparar();
    await servico.salvar(1, { name: 'Suporte', chatbot_entrada_id: 7 }, manager);
    expect(consulta).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO channel_x_chatbot'), [1, 7]);
  });

  it('não aceita um chatbot de entrada no lugar do fluxo de saída', async () => {
    const { servico, consulta, manager } = preparar();
    await expect(servico.salvar(1, { name: 'Suporte', chatbot_saida_id: 7 }, manager)).rejects.toThrow('saída');
    expect(consulta).not.toHaveBeenCalledWith(expect.stringContaining('DELETE'), expect.anything());
  });

  it('valida os setores do fluxo publicado antes de criar o vínculo', async () => {
    const { servico, manager } = preparar('entrada', 3, 11);
    await expect(servico.salvar(1, { name: 'Suporte', chatbot_entrada_id: 7 }, manager)).rejects.toThrow('setor');
  });

  it('aceita o fluxo publicado com os setores vinculados ao canal', async () => {
    const { servico, consulta, manager } = preparar('entrada', 3);
    await servico.salvar(1, { name: 'Suporte', chatbot_entrada_id: 7 }, manager);
    expect(consulta).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO channel_x_chatbot'), [1, 7]);
  });

  it('o DTO do canal permite remover associações e rejeita ids inválidos', () => {
    expect(validateSync(plainToInstance(CreateOrChannelDto, { name: 'Suporte', chatbot_entrada_id: null, chatbot_saida_id: null }))).toHaveLength(0);
    expect(validateSync(plainToInstance(CreateOrChannelDto, { name: 'Suporte', chatbot_entrada_id: -1 })))
      .toEqual(expect.arrayContaining([expect.objectContaining({ property: 'chatbot_entrada_id' })]));
  });

  it('mantém a seleção atual, priorizando o vínculo ativo entre os legados', async () => {
    const { servico, consulta } = preparar();
    consulta.mockResolvedValueOnce([{ id: 7, type: 'entrada' }, { id: 8, type: 'saida' }, { id: 9, type: 'entrada' }] as never);
    const canal = await servico.carregar({ id: 1 } as never);
    expect(canal.chatbot_entrada_id).toBe(7);
    expect(canal.chatbot_saida_id).toBe(8);
    expect(consulta).toHaveBeenCalledWith(expect.stringContaining('ORDER BY b.active DESC'), [1]);
  });

  it('o seletor não lista fluxos com o módulo global desligado', async () => {
    const { servico, consulta } = preparar();
    expect(await servico.opcoes()).toEqual([]);
    expect(consulta).toHaveBeenCalledTimes(1);
  });

  it('desabilitar o canal libera apenas a fila do bot e aborta suas execuções', async () => {
    const { servico, consulta, manager } = preparar();
    consulta.mockResolvedValueOnce([[{ id: 42 }], 1] as never);
    consulta.mockResolvedValueOnce([[{ id: 43 }], 1] as never);
    expect(await servico.desabilitar(1, manager)).toEqual([42, 43]);
    expect(consulta).toHaveBeenNthCalledWith(1,
      expect.stringContaining('support_chat_status_id = 3 AND user_id IS NULL'), [1]);
    expect(consulta).toHaveBeenNthCalledWith(2, expect.stringContaining('pos_atendimento_ativo = false'), [1]);
    expect(consulta).toHaveBeenNthCalledWith(3,
      expect.stringContaining("e.status IN ('running', 'suspended')"), [1]);
  });
});
