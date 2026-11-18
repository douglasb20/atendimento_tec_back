import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { HistoricoDto } from './dto/historico.dto';
import { SupportChatsService } from './support-chats.service';
jest.mock('@/Utils', () => ({ runInTransaction: async (banco: { manager: object }, acao: (manager: object) => unknown) => acao(banco.manager) }));
jest.mock('./entities/support-chats.entity', () => ({ SupportChats: class {} }));
jest.mock('@/chatbots/entities/chatbot-flow-versions.entity', () => ({ ChatbotFlowVersions: class {} }));
jest.mock('@/contacts/entities/contacts.entity', () => ({ Contacts: class {} }));
jest.mock('@/channels/entities/channels.entity', () => ({ Channels: class {} }));
jest.mock('@/departments/entities/departments.entity', () => ({ Departments: class {} }));
jest.mock('./entities/support-chat-events.entity', () => ({ SupportChatEvents: class {}, SupportChatEventType: {} }));
jest.mock('@/whatsapp/whatsapp.service', () => ({ WhatsappService: class {} }));
jest.mock('./messages/messages.service', () => ({ MessagesService: class {} }));
jest.mock('@/channels/channels.repository', () => ({ ChannelsRepository: class {} }));
jest.mock('@/contacts/contacts.service', () => ({ ContactsService: class {} }));
jest.mock('@/contacts/contacts.repository', () => ({ ContactsRepository: class {} }));
jest.mock('./support-chats.repository', () => ({ SupportChatsRepository: class {} }));
jest.mock('./support-chat-events.repository', () => ({ SupportChatEventsRepository: class {} }));
jest.mock('@/users/users.repository', () => ({ UserRepository: class {} }));
jest.mock('@/storage/storage.service', () => ({ StorageService: class {} }));
jest.mock('@/service-alerts/service-alerts.service', () => ({ ServiceAlertsService: class {} }));
jest.mock('@/chatbots/chatbots.repository', () => ({ ChatbotsRepository: class {} }));
jest.mock('@/chatbot-engine/chatbot-flow-executions.service', () => ({ ChatbotFlowExecutionsService: class {} }));
jest.mock('@/chatbot-engine/chatbot-flow-executions.repository', () => ({ ChatbotFlowExecutionsRepository: class {} }));
jest.mock('@/departments/departments.repository', () => ({ DepartmentsRepository: class {} }));
jest.mock('@/attendance-settings/attendance-settings.service', () => ({ AttendanceSettingsService: class {} }));
jest.mock('@/channels/channels.service', () => ({ ChannelsService: class {} }));
jest.mock('@/permissions/acesso-atendimento.service', () => ({ AcessoAtendimentoService: class {} }));
jest.mock('@/permissions/permission.service', () => ({ PermissionService: class {} }));
jest.mock('@/departments/disponibilidade-setor.service', () => ({ DisponibilidadeSetorService: class {} }));

const msg = (id: string, iso: string) => ({ id, datetime: new Date(iso), has_media: false });

function preparar(linhas: ReturnType<typeof msg>[]) {
  const chat = { id: 42, support_chat_status_id: 2, paused_at: null };
  const repo = {
    findSupportChatsById: jest.fn().mockResolvedValue({ ...chat, supportChatMessages: [] }),
    findConversaSemMensagens: jest.fn().mockResolvedValue({ ...chat }),
    findMensagensAnteriores: jest.fn().mockResolvedValue(linhas),
  };
  const servico = Object.assign(Object.create(SupportChatsService.prototype), {
    supportChatsRepository: repo,
    supportChatEventsRepository: { findPorConversa: jest.fn().mockResolvedValue([]) },
    messagesService: { getUrlForMessageMedia: (c: object) => c },
  }) as SupportChatsService;
  return { servico, repo };
}

describe('Histórico paginado', () => {
  it('sem parâmetros, usa a consulta de sempre e não manda tem_mais', async () => {
    const { servico, repo } = preparar([]);
    const resposta = await servico.findSupportChatsById(42);
    expect(repo.findSupportChatsById).toHaveBeenCalledWith(42);
    expect(repo.findMensagensAnteriores).not.toHaveBeenCalled();
    expect(resposta).not.toHaveProperty('tem_mais');
  });

  it('com limite, pede limite + 1 e devolve as mais recentes em ordem ascendente com tem_mais', async () => {
    // O repository devolve da mais nova para a mais antiga.
    const { servico, repo } = preparar([msg('c', '2026-11-16T10:03:00Z'), msg('b', '2026-11-16T10:02:00Z'), msg('a', '2026-11-16T10:01:00Z')]);
    const resposta = (await servico.findSupportChatsById(42, { limite: 2 })) as never as { supportChatMessages: { id: string }[]; tem_mais: boolean };
    expect(repo.findMensagensAnteriores).toHaveBeenCalledWith(42, 3, undefined);
    expect(resposta.supportChatMessages.map((m) => m.id)).toEqual(['b', 'c']);
    expect(resposta.tem_mais).toBe(true);
    // O rodapé do app decide pelo grupo: a página traz o da conversa.
    expect(resposta).toMatchObject({ grupo: 'em_atendimento' });
  });

  it('última página: menos linhas que o limite, tem_mais falso; antes_de repassado', async () => {
    const { servico, repo } = preparar([msg('a', '2026-11-16T10:01:00Z')]);
    const resposta = (await servico.findSupportChatsById(42, { limite: 2, antes_de: 'b' })) as never as { tem_mais: boolean };
    expect(repo.findMensagensAnteriores).toHaveBeenCalledWith(42, 3, 'b');
    expect(resposta.tem_mais).toBe(false);
  });

  it.each([0, 101, 'x'])('limite %p é recusado pela validação', async (limite) => {
    const erros = await validate(plainToInstance(HistoricoDto, { limite }));
    expect(erros.length).toBeGreaterThan(0);
  });

  it('antes_de precisa ser uuid; sem nada é válido', async () => {
    expect((await validate(plainToInstance(HistoricoDto, { limite: 50, antes_de: 'abc' }))).length).toBeGreaterThan(0);
    expect(await validate(plainToInstance(HistoricoDto, {}))).toHaveLength(0);
    expect(await validate(plainToInstance(HistoricoDto, { limite: 50, antes_de: '8d6f1c2e-3b4a-4c5d-9e6f-7a8b9c0d1e2f' }))).toHaveLength(0);
  });
});
