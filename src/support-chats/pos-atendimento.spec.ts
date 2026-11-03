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

describe('Pós-atendimento no mesmo protocolo', () => {
  function preparar() {
    const chat = { id: 42, protocol: '202611000042', contact_id: 3, channel_id: 4, user_id: 7,
      support_chat_status_id: 2, supportChatStatus: { is_final: false }, paused_at: null,
      contact: { client_id: 5 }, channel: { id: 4, mensagem_despedida: 'Obrigado!', chatbot_saida_por_padrao: true } };
    const manager = { query: jest.fn().mockResolvedValue([{ support_chat_status_id: 2, user_id: 7, paused_at: null }]),
      findOneBy: jest.fn().mockResolvedValue({ graph: { nodes: [{ id: 'fim', type: 'finish', data: {} }], edges: [] } }), update: jest.fn() };
    const repo = { findParaEstado: jest.fn().mockResolvedValue(chat), finalizar: jest.fn().mockResolvedValue(1) };
    const ajustes = { chatbotHabilitado: jest.fn().mockResolvedValue(true) };
    const permissoes = { hasPermission: jest.fn().mockResolvedValue(true) };
    const fluxos = { findSaidaAtivoDoCanal: jest.fn().mockResolvedValue({ id: 8, current_published_version_id: 9, name: 'Pós-atendimento' }) };
    const execucoes = { iniciar: jest.fn().mockResolvedValue({ id: 10 }), enfileirar: jest.fn() };
    const suspensas = { findSuspendedAwaitingReply: jest.fn().mockResolvedValue({ id: 10, phase: 'saida' }),
      registrarResposta: jest.fn().mockResolvedValue('token-saida'), abortarDoAtendimento: jest.fn() };
    const servico = Object.assign(Object.create(SupportChatsService.prototype), {
      dataSource: { manager, query: jest.fn().mockResolvedValue([[{ id: 42 }], 1]) },
      supportChatsRepository: repo, attendanceSettingsService: ajustes, chatbotsRepository: fluxos,
      permissionService: permissoes,
      chatbotFlowExecutionsService: execucoes, chatbotFlowExecutionsRepository: suspensas,
      channelsService: { copiaAnexoDespedidaParaEnvio: jest.fn() }, logger: { warn: jest.fn() },
    }) as SupportChatsService;
    const despedida = jest.spyOn(servico as never, 'enviaMensagemAutomatica' as never).mockResolvedValue(undefined as never);
    const emitir = jest.spyOn(servico as never, 'recarregaEEmiteEstado' as never).mockResolvedValue({ ...chat, support_chat_status_id: 5, pos_atendimento_ativo: true } as never);
    return { servico, chat, manager, repo, ajustes, fluxos, execucoes, suspensas, despedida, emitir, permissoes };
  }

  it.each([false, true])('despedida desabilitada=%s é independente do fluxo de saída', async sem_despedida => {
    const { servico, repo, manager, execucoes, despedida } = preparar();
    const resultado = await servico.finalizarAtendimento(42, 7, { executar_fluxo_saida: true, sem_despedida, observation_user: ' Resolvido ' });
    expect(resultado.protocol).toBe('202611000042');
    expect(repo.finalizar).toHaveBeenCalledWith(42, expect.any(Date), 'Resolvido', manager);
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), 42, { pos_atendimento_ativo: true });
    expect(execucoes.iniciar).toHaveBeenCalledWith(3, 42, expect.objectContaining({ id: 8 }), manager, 'saida');
    expect(despedida).toHaveBeenCalledTimes(sem_despedida ? 0 : 1);
    expect(execucoes.enfileirar).toHaveBeenCalledWith(10, { kind: 'start' });
  });

  it('não inicia saída quando a opção está desmarcada', async () => {
    const { servico, execucoes, despedida } = preparar();
    await servico.finalizarAtendimento(42, 7, { executar_fluxo_saida: false, sem_despedida: true });
    expect(execucoes.iniciar).not.toHaveBeenCalled(); expect(despedida).not.toHaveBeenCalled();
  });

  it.each([true, false])('sem permissão não consegue inverter o padrão %s pela API', async padrao => {
    const { servico, chat, permissoes, repo, despedida, execucoes } = preparar();
    chat.channel.chatbot_saida_por_padrao = padrao;
    permissoes.hasPermission.mockResolvedValue(false);
    await expect(servico.finalizarAtendimento(42, 7, { executar_fluxo_saida: !padrao })).rejects.toThrow('não tem permissão');
    expect(repo.finalizar).not.toHaveBeenCalled(); expect(despedida).not.toHaveBeenCalled();
    expect(execucoes.iniciar).not.toHaveBeenCalled();
  });

  it.each([true, false])('campo omitido segue o padrão %s mesmo sem permissão', async padrao => {
    const { servico, chat, permissoes, execucoes, repo } = preparar();
    chat.channel.chatbot_saida_por_padrao = padrao;
    permissoes.hasPermission.mockResolvedValue(false);
    await servico.finalizarAtendimento(42, 7, { sem_despedida: true });
    expect(execucoes.iniciar).toHaveBeenCalledTimes(padrao ? 1 : 0);
    expect(repo.finalizar).toHaveBeenCalledTimes(1);
  });

  it('com a permissão pode ligar a saída quando o padrão do canal é desligado', async () => {
    const { servico, chat, permissoes, execucoes } = preparar();
    chat.channel.chatbot_saida_por_padrao = false;
    await servico.finalizarAtendimento(42, 7, { executar_fluxo_saida: true, sem_despedida: true });
    expect(permissoes.hasPermission).toHaveBeenCalledWith(7, ['support.chat:change_exit_flow']);
    expect(execucoes.iniciar).toHaveBeenCalledTimes(1);
  });

  it('o superusuário pode alterar a escolha independentemente do grupo', async () => {
    const { servico, permissoes, execucoes } = preparar();
    permissoes.hasPermission.mockResolvedValue(false);
    await servico.finalizarAtendimento(42, 7, { executar_fluxo_saida: false, sem_despedida: true }, true);
    expect(permissoes.hasPermission).not.toHaveBeenCalled(); expect(execucoes.iniciar).not.toHaveBeenCalled();
  });

  it('informa padrão e autorização do servidor para montar o controle na interface', async () => {
    const { servico, chat, permissoes } = preparar();
    chat.channel.chatbot_saida_por_padrao = false; permissoes.hasPermission.mockResolvedValue(false);
    expect(await servico.fluxoSaidaDisponivel(42, 7)).toEqual({ id: 8, name: 'Pós-atendimento', executar_por_padrao: false, pode_alterar: false });
  });

  it('um canal sem fluxo disponível pode ser finalizado normalmente mesmo com padrão ligado', async () => {
    const { servico, permissoes, fluxos, execucoes } = preparar();
    permissoes.hasPermission.mockResolvedValue(false); fluxos.findSaidaAtivoDoCanal.mockResolvedValue(null);
    await servico.finalizarAtendimento(42, 7, { sem_despedida: true });
    expect(execucoes.iniciar).not.toHaveBeenCalled();
  });

  it('recusa a saída sem publicação, sem encerrar nem enviar despedida antes da validação', async () => {
    const { servico, fluxos, repo, despedida } = preparar();
    fluxos.findSaidaAtivoDoCanal.mockResolvedValue(null);
    await expect(servico.finalizarAtendimento(42, 7, { executar_fluxo_saida: true })).rejects.toThrow('ativo e publicado');
    expect(repo.finalizar).not.toHaveBeenCalled(); expect(despedida).not.toHaveBeenCalled();
  });

  it('não finaliza duas vezes se outro processo já mudou o estado', async () => {
    const { servico, manager, execucoes, despedida } = preparar();
    manager.query.mockResolvedValue([{ support_chat_status_id: 5, user_id: 7 }]);
    await expect(servico.finalizarAtendimento(42, 7, { executar_fluxo_saida: true })).rejects.toThrow('mudou de estado');
    expect(execucoes.iniciar).not.toHaveBeenCalled(); expect(despedida).not.toHaveBeenCalled();
  });

  it('mantém a reserva persistida quando a fila falha depois do commit', async () => {
    const { servico, execucoes } = preparar();
    execucoes.enfileirar.mockRejectedValue(new Error('Redis indisponível'));
    await expect(servico.finalizarAtendimento(42, 7, { executar_fluxo_saida: true, sem_despedida: true })).resolves.toHaveProperty('pos_atendimento_ativo', true);
  });

  it('retoma a execução de saída para a resposta sem acionar um chatbot de entrada', async () => {
    const { servico, manager, chat, suspensas } = preparar();
    const resposta = await servico['decideAcaoDoChatbot'](3,
      { ...chat, support_chat_status_id: 5, pos_atendimento_ativo: true } as never,
      { id: 4 } as never, false, 'Obrigado', manager as never, true);
    expect(resposta).toEqual({ executionId: 10, trigger: 'resume', resumeText: 'Obrigado', waitingToken: 'token-saida' });
    expect(suspensas.findSuspendedAwaitingReply).toHaveBeenCalledWith(3, 42, manager);
  });

  it('o fechamento do pós-atendimento não altera a duração, o dono ou o relato', async () => {
    const { servico } = preparar();
    await servico.concluirPosAtendimento(42);
    const consulta = (servico as unknown as { dataSource: { query: jest.Mock } }).dataSource.query.mock.calls[0][0];
    expect(consulta).toContain('pos_atendimento_ativo = false');
    expect(consulta).not.toMatch(/SET finished_at|user_id\s*=|observation_user\s*=|INSERT/i);
  });
});
