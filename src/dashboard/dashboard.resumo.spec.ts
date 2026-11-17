jest.mock('@/contacts/entities/contacts.entity', () => ({ Contacts: class {} }));
jest.mock('@/support-chats/entities/support-chats.entity', () => ({ SupportChats: class {} }));
jest.mock('@/channels/entities/channels.entity', () => ({ Channels: class {} }));
jest.mock('@/presenca/presenca.service', () => ({ PresencaService: class {} }));

import { IsNull } from 'typeorm';

import { ChannelStatus, SupportChatStatusId } from '@/@types';
import { DashboardService } from './dashboard.service';

describe('Resumo do dashboard', () => {
  let contatos: { count: jest.Mock };
  let atendimentos: { count: jest.Mock; createQueryBuilder: jest.Mock };
  let canais: { find: jest.Mock };
  let presenca: { online: jest.Mock };
  let servico: DashboardService;

  beforeEach(() => {
    const construtor = {
      select: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(40),
      getRawOne: jest.fn().mockResolvedValue({ media: '6540' }),
    };
    contatos = { count: jest.fn().mockResolvedValue(279) };
    atendimentos = {
      count: jest.fn().mockImplementation(({ where }) =>
        Promise.resolve(where.support_chat_status_id === SupportChatStatusId.AGUARDANDO ? 8 : 3),
      ),
      createQueryBuilder: jest.fn().mockReturnValue(construtor),
    };
    canais = {
      find: jest.fn().mockResolvedValue([
        { id: 2, name: 'Comercial' },
        { id: 5, name: 'Suporte' },
      ]),
    };
    presenca = { online: jest.fn().mockReturnValue([3, 7]) };
    servico = new DashboardService(contatos as never, atendimentos as never, canais as never, presenca as never);
  });

  it('mantem os campos que o portal usa', async () => {
    const resumo = await servico.resumo();

    expect(resumo.contatos).toBe(279);
    expect(resumo.finalizados).toBe(40);
    expect(resumo.emAtendimento).toBe(3);
    expect(resumo.tempoMedioSegundos).toBe(6540);
  });

  it('aguardando conta so o status AGUARDANDO, sem a fila do chatbot', async () => {
    const resumo = await servico.resumo();

    expect(resumo.aguardando).toBe(8);
    expect(atendimentos.count).toHaveBeenCalledWith({
      where: { support_chat_status_id: SupportChatStatusId.AGUARDANDO },
    });
    expect(atendimentos.count).not.toHaveBeenCalledWith({
      where: { support_chat_status_id: SupportChatStatusId.EM_FILA },
    });
  });

  it('atendentes online e a quantidade de usuarios conectados', async () => {
    expect((await servico.resumo()).atendentesOnline).toBe(2);
  });

  it('canais conectados: so conectados e nao excluidos, por nome', async () => {
    const resumo = await servico.resumo();

    expect(resumo.canaisConectados).toEqual([
      { id: 2, nome: 'Comercial' },
      { id: 5, nome: 'Suporte' },
    ]);
    expect(canais.find).toHaveBeenCalledWith({
      select: { id: true, name: true },
      where: { channel_status_id: ChannelStatus.CONNECTED, deleted_at: IsNull() },
      order: { name: 'ASC' },
    });
  });

  it('sem canal conectado devolve lista vazia', async () => {
    canais.find.mockResolvedValue([]);
    expect((await servico.resumo()).canaisConectados).toEqual([]);
  });
});
