import { UsersService } from './users.service';

jest.mock('permissions/permissions.repository', () => ({ PermissionsRepository: class {} }));
jest.mock('@/permissions/permission.service', () => ({ PermissionService: class {} }));
jest.mock('storage/storage.service', () => ({ StorageService: class {} }));
jest.mock('./users.repository', () => ({ UserRepository: class {} }));
jest.mock('./entities/users.entity', () => ({ Users: class {} }));
jest.mock('@/redis-cache/redis-cache.repository', () => ({ RedisCacheRepository: class {} }));
jest.mock('@/user-config/user-config.service', () => ({ UserConfigService: class {} }));
jest.mock('@/departments/departments.repository', () => ({ DepartmentsRepository: class {} }));
jest.mock('./user-invites.service', () => ({ UserInvitesService: class {} }));

describe('Troca do avatar sem reutilizar a URL em cache', () => {
  it('assina chaves diferentes sem sobrescrever a foto atual antes de salvar', async () => {
    const usuario = { id: 7, avatar_url: 'user/avatar/antigo.png' };
    const repository = { findById: jest.fn().mockResolvedValue(usuario) };
    const storage = { createPresignedPost: jest.fn(async (key: string, tipo: string) => ({ key, tipo })) };
    const service = new UsersService(null, repository as never, null, null,
      storage as never, null, null, null, { createQueryRunner: () => ({}) } as never);
    const pedido = { user_id: 7, key: 'user/avatar', fileType: 'image/png' };

    const primeira = await service.signAvatar(pedido);
    const segunda = await service.signAvatar({ ...pedido, fileType: 'image/jpeg' });

    expect(primeira.key).toMatch(/^user\/avatar\/[\da-f-]+\.png$/);
    expect(segunda.key).toMatch(/^user\/avatar\/[\da-f-]+\.jpeg$/);
    expect(primeira.key).not.toBe(segunda.key);
    expect(primeira.key).not.toBe(usuario.avatar_url);
    expect(usuario.avatar_url).toBe('user/avatar/antigo.png');
    expect(storage.createPresignedPost).toHaveBeenCalledTimes(2);
  });
});
