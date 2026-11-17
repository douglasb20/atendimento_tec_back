// Os módulos reais puxam as entidades do TypeORM, que têm ciclos de import
// e quebram no Jest; o teste usa dublês dos dois.
jest.mock('./channels.repository', () => ({ ChannelsRepository: class {} }));
jest.mock('./channels.service', () => ({ ChannelsService: class {} }));

import { ChannelHealthService } from './channel-health.service';

describe('ChannelHealthService', () => {
  let repo: { findConectadosComSessao: jest.Mock };
  let channels: { sincronizarStatus: jest.Mock; marcarSemResposta: jest.Mock };
  let service: ChannelHealthService;

  beforeEach(() => {
    repo = { findConectadosComSessao: jest.fn().mockResolvedValue([{ id: 1 }]) };
    channels = {
      sincronizarStatus: jest.fn().mockResolvedValue({}),
      marcarSemResposta: jest.fn().mockResolvedValue(undefined),
    };
    service = new ChannelHealthService(repo as any, channels as any);
  });

  it('sincroniza cada canal conectado', async () => {
    repo.findConectadosComSessao.mockResolvedValue([{ id: 1 }, { id: 2 }]);

    await service.verificarConectados();

    expect(channels.sincronizarStatus).toHaveBeenCalledWith(1);
    expect(channels.sincronizarStatus).toHaveBeenCalledWith(2);
    expect(channels.marcarSemResposta).not.toHaveBeenCalled();
  });

  it('não desconecta na primeira falha', async () => {
    channels.sincronizarStatus.mockRejectedValue(new Error('ECONNREFUSED'));

    await service.verificarConectados();

    expect(channels.marcarSemResposta).not.toHaveBeenCalled();
  });

  it('desconecta na segunda falha seguida', async () => {
    channels.sincronizarStatus.mockRejectedValue(new Error('ECONNREFUSED'));

    await service.verificarConectados();
    await service.verificarConectados();

    expect(channels.marcarSemResposta).toHaveBeenCalledTimes(1);
    expect(channels.marcarSemResposta).toHaveBeenCalledWith(1);
  });

  it('uma resposta no meio zera a contagem', async () => {
    channels.sincronizarStatus
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('timeout'));

    await service.verificarConectados();
    await service.verificarConectados();
    await service.verificarConectados();

    expect(channels.marcarSemResposta).not.toHaveBeenCalled();
  });

  it('canal que saiu de conectado perde a contagem', async () => {
    channels.sincronizarStatus.mockRejectedValue(new Error('timeout'));

    await service.verificarConectados();
    repo.findConectadosComSessao.mockResolvedValueOnce([]);
    await service.verificarConectados();
    await service.verificarConectados();

    expect(channels.marcarSemResposta).not.toHaveBeenCalled();
  });

  it('falha de um canal não impede a verificação dos outros', async () => {
    repo.findConectadosComSessao.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    channels.sincronizarStatus.mockImplementation(async (id: number) => {
      if (id === 1) throw new Error('timeout');
      return {};
    });
    channels.marcarSemResposta.mockRejectedValue(new Error('banco fora'));

    await service.verificarConectados();
    await expect(service.verificarConectados()).resolves.toBeUndefined();

    expect(channels.sincronizarStatus).toHaveBeenCalledWith(2);
    expect(channels.marcarSemResposta).toHaveBeenCalledWith(1);
  });
});
