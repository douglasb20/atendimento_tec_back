import { UnauthorizedException } from '@nestjs/common';

// O AuthService real puxa as entidades do TypeORM, que têm ciclos de import e
// quebram no Jest; o controller recebe um dublê.
jest.mock('./auth.service', () => ({ AuthService: class {} }));

import { AuthMobileController } from './auth-mobile.controller';

describe('AuthMobileController', () => {
  const usuario = { id: 7, nome: 'Ana', sobrenome: 'Lima', email: 'ana@exemplo.com' };
  let authService: { signin: jest.Mock; refresh: jest.Mock; revogarRefresh: jest.Mock };
  let jwtService: { decode: jest.Mock };
  let controller: AuthMobileController;
  const request = { cookies: { refresh_token: 'do-cookie' } } as any;

  beforeEach(() => {
    authService = {
      signin: jest.fn().mockResolvedValue({
        access_token: 'access-1',
        refresh_token: 'refresh-1',
        expiresAt: 999,
        usuario,
      }),
      refresh: jest.fn().mockResolvedValue({
        access_token: 'access-2',
        refresh_token: 'refresh-2',
        refresh_expires: 999,
      }),
      revogarRefresh: jest.fn().mockResolvedValue(undefined),
    };
    jwtService = { decode: jest.fn().mockReturnValue({ exp: 1234 }) };
    controller = new AuthMobileController(authService as any, jwtService as any);
  });

  it('signin devolve tokens e usuario no corpo, sem tocar em cookie', async () => {
    const resposta = await controller.signin({ email: 'ana@exemplo.com', password: 'x' } as any, request);

    expect(authService.signin).toHaveBeenCalledWith('ana@exemplo.com', 'x', request);
    expect(resposta).toEqual({
      access_token: 'access-1',
      refresh_token: 'refresh-1',
      expires_at: 1234,
      usuario,
    });
    expect(jwtService.decode).toHaveBeenCalledWith('access-1');
  });

  it('refresh le so o corpo, ignorando o cookie do portal', async () => {
    const resposta = await controller.refresh({ refresh_token: 'do-corpo' }, request);

    expect(authService.refresh).toHaveBeenCalledWith('do-corpo', request);
    expect(resposta).toEqual({ access_token: 'access-2', refresh_token: 'refresh-2', expires_at: 1234 });
  });

  it('refresh revogado ou reutilizado responde 401', async () => {
    authService.refresh.mockRejectedValue(new UnauthorizedException('Refresh token não encontrado'));

    await expect(controller.refresh({ refresh_token: 'velho' }, request)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('logout revoga o refresh do corpo', async () => {
    await expect(controller.logout({ refresh_token: 'refresh-1' })).resolves.toEqual({ status: 'ok' });
    expect(authService.revogarRefresh).toHaveBeenCalledWith('refresh-1');
  });

  it('logout sem token nao falha e nao revoga nada', async () => {
    await expect(controller.logout({} as any)).resolves.toEqual({ status: 'ok' });
    expect(authService.revogarRefresh).not.toHaveBeenCalled();
  });
});
