import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Users } from 'users/entities/users.entity';
import { PermissionService } from './permission.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly permissionService: PermissionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: Users = request.user; // Usuário autenticado, já injetado pelo AuthGuard
    const handler = context.getHandler(); // Obtém o handler (método do controller)
    const requiredPermission = this.getRequiredPermission(handler); // Pega a permissão do método

    if (!user) {
      throw new UnauthorizedException('Usuário não autenticado');
    }
    if(requiredPermission === '') {
      return true; // Se não há permissão necessária, permite o acesso
    }

    const hasPermission = await this.permissionService.hasPermission(
      user.id, // Id do usuário autenticado
      requiredPermission, // A permissão que você está verificando
    );

    if (!hasPermission && !user.is_superuser) {
      throw new UnauthorizedException('Você não tem permissão');
    }

    return true;
  }

  // Função para obter a permissão necessária a partir dos metadados
  private getRequiredPermission(handler: Function): string {
    const permissions = Reflect.getMetadata('permissions', handler);
    return permissions || '';
  }
}
