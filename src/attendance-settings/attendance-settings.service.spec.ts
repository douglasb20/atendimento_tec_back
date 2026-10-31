import { AttendanceSettingsService } from './attendance-settings.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AttendanceSettingsRepository } from './attendance-settings.repository';
import { DataSource } from 'typeorm';

jest.mock('Utils', () => ({ runInTransaction: async (banco: { manager: unknown }, acao: (manager: unknown) => unknown) => acao(banco.manager) }));
jest.mock('./attendance-settings.repository', () => ({ AttendanceSettingsRepository: class {} }));

describe('Habilitação do módulo Chatbot', () => {
  function preparar(habilitado = true) {
    const consultas: string[] = [];
    const manager = { query: jest.fn(async (sql: string) => {
      consultas.push(sql);
      if (sql.startsWith('SELECT')) return [{ valor: String(habilitado) }];
      if (sql.includes('UPDATE support_chats')) return [[{ id: 10 }], 1];
      return [[], 0];
    }) };
    const repositorio = { grava: jest.fn(), todos: jest.fn().mockResolvedValue([]) };
    const eventos = { emitAsync: jest.fn() };
    const servico = new AttendanceSettingsService(repositorio as unknown as AttendanceSettingsRepository,
      { manager, query: manager.query } as unknown as DataSource, eventos as unknown as EventEmitter2);
    return { servico, repositorio, manager, eventos, consultas };
  }

  it('lê a habilitação do banco e usa lock compartilhado durante a execução', async () => {
    const { servico, manager, consultas } = preparar();
    expect(await servico.chatbotHabilitado(manager as never)).toBe(true);
    expect(consultas[0]).toContain('FOR SHARE');
  });

  it('recusa execução quando o módulo está desligado', async () => {
    expect(await preparar(false).servico.chatbotHabilitado()).toBe(false);
  });

  it('encaminha para espera e aborta fluxos ao desabilitar, sem apagar cadastros', async () => {
    const { servico, repositorio, eventos, consultas } = preparar();
    await servico.atualizar({ chatbot_habilitado: false }, 1);
    expect(repositorio.grava).toHaveBeenCalledWith('chatbot_habilitado', 'false', 1, expect.anything());
    expect(consultas[0]).toContain('UPDATE support_chats');
    expect(consultas[0]).toContain('support_chat_status_id = 3 AND user_id IS NULL');
    expect(consultas[1]).toContain("status = 'aborted'");
    expect(consultas.join(' ')).not.toMatch(/DELETE|UPDATE chatbots /);
    expect(eventos.emitAsync).toHaveBeenCalledWith('atendimento.ajustes-atualizados', { encaminhados: [10] });
  });

  it('habilitar não retoma execuções antigas nem altera publicação', async () => {
    const { servico, consultas } = preparar();
    await servico.atualizar({ chatbot_habilitado: true }, 1);
    expect(consultas).toEqual([]);
  });

  it('não trata uma string false como true', async () => {
    const { servico, repositorio } = preparar();
    await expect(servico.atualizar({ chatbot_habilitado: 'false' } as never, 1)).rejects.toThrow('deve ser booleano');
    expect(repositorio.grava).not.toHaveBeenCalled();
  });

  it('remove o ajuste global de notificação do catálogo', async () => {
    const { servico } = preparar();
    const catalogo = await servico.paraTela();
    expect(catalogo.some(a => a.chave === 'notificar_mensagem_chatbot')).toBe(false);
    expect(catalogo.find(a => a.chave === 'chatbot_habilitado')?.valor).toBe(false);
  });
});
