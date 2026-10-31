import { ChatbotHabilitadoGuard } from './chatbot-habilitado.guard';
jest.mock('@/attendance-settings/attendance-settings.service', () => ({ AttendanceSettingsService: class {} }));

describe('Acesso ao módulo Chatbot', () => {
  it('bloqueia as rotas quando o módulo está desabilitado, mesmo com permissão', async () => {
    const guard = new ChatbotHabilitadoGuard({ chatbotHabilitado: async () => false } as never);
    await expect(guard.canActivate()).rejects.toThrow('desabilitado');
  });

  it('libera a etapa do módulo quando está habilitado; permissões seguem independentes', async () => {
    const guard = new ChatbotHabilitadoGuard({ chatbotHabilitado: async () => true } as never);
    expect(await guard.canActivate()).toBe(true);
  });
});
