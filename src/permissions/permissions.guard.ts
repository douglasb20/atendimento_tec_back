import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { Users } from 'users/entities/users.entity';
import { PermissionService } from './permission.service';
import { APENAS_SUPERUSUARIO } from './apenas-superusuario.decorator';
import { SEM_PERMISSAO } from './sem-permissao.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  private readonly logger = new Logger(PermissionGuard.name);

  constructor(
    private readonly permissionService: PermissionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: Users = request.user; // populado pelo AuthGuard('jwt')
    const handler = context.getHandler();

    if (!user) {
      throw new UnauthorizedException('Usuário não autenticado');
    }

    // Reservado ao usuário master — checado antes de tudo, inclusive do desvio
    // de superusuário abaixo, porque aqui ele é a única via de acesso.
    if (this.reflector.get<boolean>(APENAS_SUPERUSUARIO, handler)) {
      if (!user.is_superuser) {
        throw new ForbiddenException('Esta área é restrita ao usuário master do sistema.');
      }
      return true;
    }

    // Liberação explícita. Ver `sem-permissao.decorator.ts`: sem ela, endpoint
    // sem `@Permissions` é negado.
    if (this.reflector.get<boolean>(SEM_PERMISSAO, handler)) {
      return true;
    }

    // O metadado é lido do handler **e** da classe: um `@Permissions` no
    // `@Controller` vale para todos os métodos. Antes só o handler era
    // consultado, e a anotação na classe era ignorada em silêncio.
    const requeridas =
      this.reflector.get<string[]>('permissions', handler) ??
      this.reflector.get<string[]>('permissions', context.getClass());

    // Superusuário antes da consulta: não adianta ir ao banco por quem passa de
    // qualquer jeito. Antes a ordem era a inversa, e toda requisição dele
    // gastava uma consulta inútil.
    if (user.is_superuser) {
      return true;
    }

    if (!requeridas?.length) {
      // Negar é o padrão. Esquecer de anotar um endpoint passa a dar 403, não
      // acesso livre — e o log diz qual, para o conserto ser rápido.
      this.logger.warn(
        `Endpoint sem @Permissions nem @SemPermissao: ${context.getClass().name}.${handler.name}`,
      );
      throw new ForbiddenException('Endpoint sem permissão declarada');
    }

    const temPermissao = await this.permissionService.hasPermission(user.id, requeridas);

    if (!temPermissao) {
      throw new ForbiddenException('Você não tem permissão');
    }

    return true;
  }
}
