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
jest.mock('@/push/push.service', () => ({ PushService: class {} }));

/**
 * Ganchos do push no recebimento e na transferência (Fase 2b do app). Rodam
 * depois do commit e sem `await` de quem chama: a conversa é relida já com
 * contato e cliente, e nenhuma falha pode voltar para a fila de mensagens.
 */
function preparar(conversa: object | null = { id: 42, user_id: 7 }) {
  const avisarMensagem = jest.fn().mockResolvedValue(undefined);
  const avisarTransferencia = jest.fn().mockResolvedValue(undefined);
  const erro = jest.fn();
  const servico = Object.assign(Object.create(SupportChatsService.prototype), {
    supportChatsRepository: { findParaEstado: jest.fn().mockResolvedValue(conversa) },
    pushService: { avisarMensagem, avisarTransferencia },
    logger: { log: jest.fn(), warn: jest.fn(), error: erro },
  }) as SupportChatsService;
  return { servico, avisarMensagem, avisarTransferencia, erro };
}

const mensagem = { type: 'chat', content: 'oi', from_me: false };

describe('Push no recebimento', () => {
  it('relê a conversa e avisa a mensagem', async () => {
    const { servico, avisarMensagem } = preparar();
    await servico['avisarMensagemNoCelular'](42, mensagem);
    expect(avisarMensagem).toHaveBeenCalledWith({ id: 42, user_id: 7 }, mensagem);
  });

  it('conversa que sumiu não avisa', async () => {
    const { servico, avisarMensagem } = preparar(null);
    await servico['avisarMensagemNoCelular'](42, mensagem);
    expect(avisarMensagem).not.toHaveBeenCalled();
  });

  it('erro ao reler não lança', async () => {
    const { servico, erro } = preparar();
    servico['supportChatsRepository'].findParaEstado = jest.fn().mockRejectedValue(new Error('banco fora'));
    await expect(servico['avisarMensagemNoCelular'](42, mensagem)).resolves.toBeUndefined();
    expect(erro).toHaveBeenCalled();
  });
});

describe('Push na transferência', () => {
  it('avisa o destino com a conversa relida', async () => {
    const { servico, avisarTransferencia } = preparar();
    await servico['avisarTransferenciaNoCelular'](42, 9);
    expect(avisarTransferencia).toHaveBeenCalledWith({ id: 42, user_id: 7 }, 9);
  });

  it('transferência para a fila não avisa ninguém', async () => {
    const { servico, avisarTransferencia } = preparar();
    await servico['avisarTransferenciaNoCelular'](42, null);
    expect(avisarTransferencia).not.toHaveBeenCalled();
  });
});
