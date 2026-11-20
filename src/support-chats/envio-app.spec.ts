import { SupportChatsService } from './support-chats.service';
jest.mock('@/push/push.service', () => ({ PushService: class {} }));
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

function preparar(conversa: Partial<{ support_chat_status_id: number; user_id: number | null; paused_at: Date | null }> = {}) {
  const chat = { id: 42, support_chat_status_id: 2, user_id: 7, paused_at: null, channel: { session_id: 'S1' }, contact: {}, ...conversa };
  const enviar = jest.fn().mockResolvedValue({ messageId: 'WAMSG1' });
  const salvar = jest.fn().mockImplementation(async (dados: { messageId: string; content: string }) => ({
    id: 'uuid-1', message_id: dados.messageId, content: dados.content, has_media: false, lastMessage: { id: 'uuid-1' },
  }));
  const servico = Object.assign(Object.create(SupportChatsService.prototype), {
    dataSource: { manager: {} },
    supportChatsRepository: { findOne: jest.fn().mockResolvedValue(chat), updateLastMessage: jest.fn() },
    whatsappService: { sendMessage: enviar },
    messagesService: { saveOutgoing: salvar, comUrlPublica: (m: object) => m },
    logger: { log: jest.fn(), warn: jest.fn() },
  }) as SupportChatsService;
  jest.spyOn(servico as never, 'emitePreviaDoEnvio' as never).mockResolvedValue(undefined as never);
  jest.spyOn(servico as never, 'marcarComoLida' as never).mockResolvedValue(undefined as never);
  jest.spyOn(servico as never, 'marcarLidasNoWhatsapp' as never).mockResolvedValue(undefined as never);
  return { servico, enviar, salvar };
}

describe('Envio pelo app', () => {
  it.each([4, 5, 6, 7])('conversa finalizada (status %p) recusa o envio sem chamar o provider', async (status) => {
    const { servico, enviar } = preparar({ support_chat_status_id: status });
    await expect(servico.sendMessage(42, 7, '5511@s.whatsapp.net', '*Ana:*\noi')).rejects.toThrow('Atendimento finalizado');
    expect(enviar).not.toHaveBeenCalled();
  });

  it('envio bem-sucedido devolve a mensagem salva, com o prefixo', async () => {
    const { servico } = preparar();
    const resposta = await servico.sendMessage(42, 7, '5511@s.whatsapp.net', '*Ana:*\noi');
    expect(resposta).toMatchObject({ status: 'message sent', message_id: 'WAMSG1', mensagem: { id: 'uuid-1', content: '*Ana:*\noi' } });
    expect(resposta.mensagem).not.toHaveProperty('lastMessage');
  });

  it('falha ao gravar devolve mensagem nula e não lança (o envio já saiu)', async () => {
    const { servico, salvar } = preparar();
    salvar.mockRejectedValue(new Error('banco fora'));
    const resposta = await servico.sendMessage(42, 7, '5511@s.whatsapp.net', '*Ana:*\noi');
    expect(resposta).toMatchObject({ message_id: 'WAMSG1', mensagem: null });
  });
});

describe('Envio de áudio com duração', () => {
  function prepararMidia(enviada: object = { messageId: 'WAMSG2' }, tamanho: number | null = 2516582) {
    const registrar = jest.fn().mockResolvedValue({ id: 'uuid-2' });
    const servico = Object.assign(Object.create(SupportChatsService.prototype), {
      storageService: { getPublicUrl: (k: string) => `https://b/${k}`, tamanhoDoObjeto: jest.fn().mockResolvedValue(tamanho) },
      whatsappService: { sendMedia: jest.fn().mockResolvedValue(enviada) },
      messagesService: { reservaEnvioComMidia: jest.fn() },
      logger: { log: jest.fn(), warn: jest.fn() },
    }) as SupportChatsService;
    jest.spyOn(servico as never, 'carregaParaEscrita' as never).mockResolvedValue({ id: 42, channel: { session_id: 'S1' } } as never);
    jest.spyOn(servico as never, 'registraEnvio' as never).mockImplementation(registrar as never);
    return { servico, registrar };
  }

  it('voz com duração grava "MM:SS" no conteúdo, como os áudios recebidos', async () => {
    const { servico, registrar } = prepararMidia();
    await servico.sendMedia(42, 7, { chat_id: '5511@s.whatsapp.net', media_key: 'chat/voices/a', media_type: 'voice' as never, duration: 65 });
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ content: '01:05' }));
  });

  it('sem duração no pedido (portal) usa a que o gateway mediu', async () => {
    const { servico, registrar } = prepararMidia({ messageId: 'WAMSG2', seconds: 9 });
    await servico.sendMedia(42, 7, { chat_id: '5511@s.whatsapp.net', media_key: 'chat/voices/a', media_type: 'voice' as never });
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ content: '00:09' }));
  });

  it('sem duração em lugar nenhum o conteúdo continua vazio', async () => {
    const { servico, registrar } = prepararMidia();
    await servico.sendMedia(42, 7, { chat_id: '5511@s.whatsapp.net', media_key: 'chat/voices/a', media_type: 'voice' as never });
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ content: '' }));
  });

  it('a onda que o gateway calculou é gravada com a mensagem', async () => {
    const { servico, registrar } = prepararMidia({ messageId: 'WAMSG2', waveform: [10, 90] });
    await servico.sendMedia(42, 7, { chat_id: '5511@s.whatsapp.net', media_key: 'chat/voices/a', media_type: 'voice' as never });
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ waveform: [10, 90] }));
  });

  it('documento enviado grava o tamanho lido do bucket', async () => {
    const { servico, registrar } = prepararMidia();
    await servico.sendMedia(42, 7, { chat_id: '5511@s.whatsapp.net', media_key: 'chat/media/a.pdf', media_type: 'document' as never, file_name: 'a.pdf' });
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ mediaSize: 2516582 }));
  });

  it('falha ao ler o tamanho envia e grava sem tamanho', async () => {
    const { servico, registrar } = prepararMidia({ messageId: 'WAMSG2' }, null);
    const resposta = await servico.sendMedia(42, 7, { chat_id: '5511@s.whatsapp.net', media_key: 'chat/media/a.pdf', media_type: 'document' as never });
    expect(resposta).toMatchObject({ status: 'media sent' });
    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({ mediaSize: null }));
  });
});
