import { ExecutionContext, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from '@/permissions/permissions.guard';
import { PermissionService } from '@/permissions/permission.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { AssinarMeuAvatarDto } from './dto/assinar-meu-avatar.dto';

jest.mock('./users.service', () => ({ UsersService: class {} }));
jest.mock('./entities/users.entity', () => ({ Users: class {} }));
jest.mock('@/Utils', () => ({ nomeCompleto: () => 'Atendente' }));
jest.mock('@/permissions/permission.service', () => ({ PermissionService: class {} }));

describe('Upload da foto do próprio perfil', () => {
  const usuario = { id: 7, is_superuser: 0 };
  const req = { user: usuario } as never;
  const assinatura = { url: 'https://storage/upload', key: 'user/avatar/foto.png', method: 'PUT' };
  const servico = { signAvatar: jest.fn().mockResolvedValue(assinatura) };
  const controller = new UsersController(servico as unknown as UsersService);
  const permissoes = new Set<string>();
  const guard = new PermissionGuard({ hasPermission: async (_id: number, nomes: string[]) => nomes.some(nome => permissoes.has(nome)) } as PermissionService, new Reflector());
  const contexto = (handler: object): ExecutionContext => ({
    getHandler: () => handler, getClass: () => UsersController,
    switchToHttp: () => ({ getRequest: () => ({ user: usuario }) }),
  }) as ExecutionContext;

  beforeEach(() => { permissoes.clear(); servico.signAvatar.mockClear(); });

  it('permite assinar a própria foto com permissão de perfil, sem editar usuários', async () => {
    permissoes.add('user:profile_update');
    await expect(guard.canActivate(contexto(controller.assinarMeuAvatar))).resolves.toBe(true);
    await expect(controller.assinarMeuAvatar({ fileType: 'image/png' }, req)).resolves.toEqual(assinatura);
    expect(servico.signAvatar).toHaveBeenCalledWith({ user_id: 7, key: 'user/avatar', fileType: 'image/png' });
  });

  it('ignora tentativas de escolher outro usuário ou pasta no corpo', async () => {
    await controller.assinarMeuAvatar({ fileType: 'image/png', user_id: 99, key: 'outra/pasta' } as AssinarMeuAvatarDto, req);
    expect(servico.signAvatar).toHaveBeenCalledWith({ user_id: 7, key: 'user/avatar', fileType: 'image/png' });
  });

  it('recusa assinatura própria sem permissão de alterar o perfil', async () => {
    await expect(guard.canActivate(contexto(controller.assinarMeuAvatar))).rejects.toMatchObject({ status: 403 });
  });

  it('mantém a rota administrativa bloqueada para quem só pode editar o perfil', async () => {
    permissoes.add('user:profile_update');
    await expect(guard.canActivate(contexto(controller.signAvatar))).rejects.toMatchObject({ status: 403 });
    permissoes.add('user:update');
    await expect(guard.canActivate(contexto(controller.signAvatar))).resolves.toBe(true);
  });

  it('rejeita pedido sem o tipo do arquivo', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });
    await expect(pipe.transform({}, { type: 'body', metatype: AssinarMeuAvatarDto })).rejects.toMatchObject({ status: 400 });
  });
});
