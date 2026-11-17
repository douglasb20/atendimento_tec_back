// As entidades reais têm ciclos de import que quebram no Jest.
jest.mock('users/entities/users.entity', () => ({ Users: class {} }));
jest.mock('users/entities/user-refresh-tokens.entity', () => ({ UserRefreshTokens: class UserRefreshTokens {} }));
jest.mock('users/users.repository', () => ({ UserRepository: class {} }));
jest.mock('@/system-settings/system-settings.service', () => ({ SystemSettingsService: class {} }));

import { UserRefreshTokens } from 'users/entities/user-refresh-tokens.entity';
import { AuthService } from './auth.service';

describe('AuthService.revogarRefresh', () => {
  it('apaga a linha pelo token', async () => {
    const remover = jest.fn().mockResolvedValue({ affected: 1 });
    const servico = new AuthService({} as any, {} as any, {} as any, { manager: { delete: remover } } as any);

    await servico.revogarRefresh('refresh-1');

    expect(remover).toHaveBeenCalledWith(UserRefreshTokens, { refresh_token: 'refresh-1' });
  });

  it('token inexistente nao e erro', async () => {
    const remover = jest.fn().mockResolvedValue({ affected: 0 });
    const servico = new AuthService({} as any, {} as any, {} as any, { manager: { delete: remover } } as any);

    await expect(servico.revogarRefresh('nao-existe')).resolves.toBeUndefined();
  });
});
