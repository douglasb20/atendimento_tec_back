import 'reflect-metadata';
import { ChatbotsController } from './chatbots.controller';
import { PermissionGuard } from 'permissions/permissions.guard';
import { Reflector } from '@nestjs/core';
jest.mock('./chatbots.service', () => ({ ChatbotsService: class {} }));
jest.mock('./chatbot-habilitado.guard', () => ({ ChatbotHabilitadoGuard: class {} }));
jest.mock('permissions/permission.service', () => ({ PermissionService: class {} }));
jest.mock('./entities/chatbots.entity', () => ({ Chatbots: class {} }));
jest.mock('./entities/chatbot-flow-versions.entity', () => ({ ChatbotFlowVersions: class {} }));

describe('Permissões das operações de chatbot', () => {
  it.each([
    ['findAll', 'chatbot:view'], ['findOne', 'chatbot:view'], ['findDraft', 'chatbot:view'],
    ['create', 'chatbot:add'], ['update', 'chatbot:update'], ['saveFlow', 'chatbot:update'],
    ['remove', 'chatbot:delete'], ['publish', 'chatbot:publish'], ['unpublish', 'chatbot:publish'],
    ['assinarMedia', 'chatbot:update'],
  ])('%s exige %s', (metodo, permissao) => {
    expect(Reflect.getMetadata('permissions', ChatbotsController.prototype[metodo])).toEqual([permissao]);
  });

  function acesso(permissoes: string[], usuario: object = { id: 1, is_superuser: 0 }) {
    const guard = new PermissionGuard({ hasPermission: async (_id: number, exigidas: string[]) => exigidas.some(p => permissoes.includes(p)) } as never, new Reflector());
    return (metodo: string) => guard.canActivate({
      switchToHttp: () => ({ getRequest: () => ({ user: usuario }) }),
      getHandler: () => ChatbotsController.prototype[metodo], getClass: () => ChatbotsController,
    } as never);
  }

  it('editar não autoriza publicar ou despublicar', async () => {
    const validar = acesso(['chatbot:update']);
    expect(await validar('saveFlow')).toBe(true);
    await expect(validar('publish')).rejects.toThrow('não tem permissão');
    await expect(validar('unpublish')).rejects.toThrow('não tem permissão');
  });

  it('visualização não autoriza alterar nem excluir', async () => {
    const validar = acesso(['chatbot:view']);
    expect(await validar('findDraft')).toBe(true);
    await expect(validar('saveFlow')).rejects.toThrow();
    await expect(validar('remove')).rejects.toThrow();
  });

  it('publicação autoriza publicar e despublicar, mas não editar', async () => {
    const validar = acesso(['chatbot:publish']);
    expect(await validar('publish')).toBe(true);
    expect(await validar('unpublish')).toBe(true);
    await expect(validar('saveFlow')).rejects.toThrow();
  });
});
