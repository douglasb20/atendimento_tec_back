import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from '@/permissions/permissions.guard';
import { PermissionService } from '@/permissions/permission.service';
import { HolidaysController } from './holidays.controller';

jest.mock('@/permissions/permission.service', () => ({ PermissionService: class {} }));
jest.mock('./holidays.service', () => ({ HolidaysService: class {} }));

describe('Feriados na agenda', () => {
  const guarda = new PermissionGuard({
    hasPermission: jest.fn(async (_id: number, permissoes: string[]) => permissoes.includes('schedule:view')),
  } as unknown as PermissionService, new Reflector());

  const contexto = (metodo: keyof HolidaysController) => ({
    switchToHttp: () => ({ getRequest: () => ({ user: { id: 7, is_superuser: false } }) }),
    getHandler: () => HolidaysController.prototype[metodo],
    getClass: () => HolidaysController,
  } as unknown as ExecutionContext);

  it('permite consultar o calendário com acesso somente à agenda', async () => {
    await expect(guarda.canActivate(contexto('findAll'))).resolves.toBe(true);
  });

  it.each(['create', 'update', 'remove'] as const)('não permite %s feriado com acesso somente à agenda', async (metodo) => {
    await expect(guarda.canActivate(contexto(metodo))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
