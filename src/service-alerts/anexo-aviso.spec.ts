import { ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from '@/permissions/permissions.guard';
import { ServiceAlertsService } from './service-alerts.service';
import { ServiceAlertsController } from './service-alerts.controller';
import { CreateServiceAlertDto } from './dto/create-service-alert.dto';
import { UpdateServiceAlertDto } from './dto/update-service-alert.dto';
import { AssinarAnexoAvisoDto } from './dto/assinar-anexo-aviso.dto';

jest.mock('@/Utils', () => ({ runInTransaction: async (banco, acao) => acao(banco.manager) }));
jest.mock('@/channels/entities/channels.entity', () => ({ Channels: class {} }));
jest.mock('./entities/service-alerts.entity', () => ({ ServiceAlerts: class {} }));
jest.mock('./service-alerts.repository', () => ({ ServiceAlertsRepository: class {} }));
jest.mock('@/storage/storage.service', () => ({ StorageService: class {} }));
jest.mock('@/permissions/permission.service', () => ({ PermissionService: class {} }));

describe('Anexos dos avisos', () => {
  function preparar() {
    const atual = { id: 1, titulo: 'Aviso', mensagem: 'Texto', channels: [], ativo: true,
      anexo_key: 'service-alerts/antigo.pdf', anexo_nome: 'antigo.pdf',
      anexo_mimetype: 'application/pdf', anexo_tipo: 'document' };
    const repository = { findById: jest.fn(async () => atual), findAllActive: jest.fn(async () => [atual]) };
    const manager = { create: jest.fn((_tipo, dados) => dados),
      save: jest.fn(async (_tipo, dados) => Object.assign(atual, dados)),
      findOne: jest.fn(async () => atual), find: jest.fn(async () => []), update: jest.fn() };
    const storage = { createPresignedPost: jest.fn(async (key, tipo) => ({ key, tipo })),
      getPublicUrl: jest.fn(key => 'https://storage/' + key), copyObject: jest.fn(), deleteObject: jest.fn() };
    const service = new ServiceAlertsService(repository as never, { manager } as never, storage as never);
    return { service, storage, manager, atual };
  }

  it('assina em pasta separada e usa chave nova, com extensão original', async () => {
    const { service } = preparar();
    const primeira = await service.assinarAnexo({ fileName: 'arquivo.pdf', fileType: 'application/pdf' });
    const segunda = await service.assinarAnexo({ fileName: 'arquivo.pdf', fileType: 'application/pdf' });
    expect(primeira.key).toMatch(/^service-alerts\/[\da-f-]+\.pdf$/);
    expect(primeira.key).not.toBe(segunda.key);
  });

  it('copia o arquivo por envio, sem referenciar o cadastro nas mensagens', async () => {
    const { service, storage, atual } = preparar();
    const primeira = await service.copiaAnexoParaEnvio(atual as never);
    const segunda = await service.copiaAnexoParaEnvio(atual as never);
    expect(primeira.media_key).toMatch(/^chat\/media\/[\da-f-]+\.pdf$/);
    expect(segunda.media_key).not.toBe(primeira.media_key);
    expect(storage.copyObject).toHaveBeenCalledWith(atual.anexo_key, primeira.media_key);
    expect(primeira).toMatchObject({ file_name: 'antigo.pdf', media_type: 'document', mimetype: 'application/pdf' });
  });

  it('aviso sem anexo mantém envio somente de texto', async () => {
    const { service, storage, atual } = preparar();
    await expect(service.copiaAnexoParaEnvio({ ...atual, anexo_key: null } as never)).resolves.toBeNull();
    expect(storage.copyObject).not.toHaveBeenCalled();
  });

  it('omite para preservar, remove com null e devolve URL sem alterar a chave', async () => {
    const { service, storage, atual } = preparar();
    await service.update(1, { titulo: 'Novo' });
    expect(atual.anexo_key).toBe('service-alerts/antigo.pdf');
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect((await service.findAll())[0]).toMatchObject({ anexo_url: 'https://storage/service-alerts/antigo.pdf' });
    await service.update(1, { anexo_key: null });
    expect(atual).toMatchObject({ anexo_key: null, anexo_nome: null, anexo_tipo: null, anexo_mimetype: null });
    expect(storage.deleteObject).toHaveBeenCalledWith('service-alerts/antigo.pdf');
  });

  it('cria com anexo e substitui sem apagar o anterior antes do salvamento', async () => {
    const { service, storage, manager, atual } = preparar();
    const anexo = { anexo_key: 'service-alerts/novo.pdf', anexo_nome: 'novo.pdf',
      anexo_tipo: 'document', anexo_mimetype: 'application/pdf' };
    await service.create({ titulo: ' Novo ', mensagem: 'Texto', ...anexo });
    expect(atual).toMatchObject({ titulo: 'Novo', ...anexo });
    manager.save.mockRejectedValueOnce(new Error('Falha controlada'));
    await expect(service.update(1, { ...anexo, anexo_key: 'service-alerts/outro.pdf' })).rejects.toThrow();
    expect(storage.deleteObject).not.toHaveBeenCalled();
  });

  it('update rejeita conjunto incompleto mesmo com campos opcionais no DTO parcial', async () => {
    const { service } = preparar();
    await expect(service.update(1, { anexo_key: 'service-alerts/novo.pdf' })).rejects.toMatchObject({ status: 400 });
  });

  it('valida pasta, metadados e assinatura, mantendo aviso antigo sem anexo válido', async () => {
    const pipe = new ValidationPipe({ transform: true, whitelist: true });
    await expect(pipe.transform({ titulo: 'Aviso', mensagem: 'Texto' }, { type: 'body', metatype: CreateServiceAlertDto })).resolves.toBeDefined();
    await expect(pipe.transform({ titulo: 'Aviso', mensagem: 'Texto', anexo_key: 'channels/arquivo.pdf' },
      { type: 'body', metatype: CreateServiceAlertDto })).rejects.toMatchObject({ status: 400 });
    await expect(pipe.transform({ fileType: 'image/png' }, { type: 'body', metatype: AssinarAnexoAvisoDto })).rejects.toMatchObject({ status: 400 });
    await expect(pipe.transform({ anexo_key: null }, { type: 'body', metatype: UpdateServiceAlertDto })).resolves.toBeDefined();
  });

  it.each(['service.alert:add', 'service.alert:update'])('assinatura exige permissão de aviso: %s', async permissao => {
    const { service } = preparar();
    const controller = new ServiceAlertsController(service);
    const permitidas = new Set([permissao]);
    const guard = new PermissionGuard({ hasPermission: async (_id, nomes) => nomes.some(nome => permitidas.has(nome)) } as never, new Reflector());
    const contexto = { getHandler: () => controller.assinarAnexo, getClass: () => ServiceAlertsController,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 7 } }) }) } as never;
    await expect(guard.canActivate(contexto)).resolves.toBe(true);
    permitidas.clear();
    await expect(guard.canActivate(contexto)).rejects.toMatchObject({ status: 403 });
  });
});
