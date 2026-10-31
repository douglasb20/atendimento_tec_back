import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { AcessoAtendimentoService } from './acesso-atendimento.service';

@Injectable()
export class AcessoAtendimentoGuard implements CanActivate {
  constructor(private readonly acesso: AcessoAtendimentoService) {}
  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const req = contexto.switchToHttp().getRequest();
    const id = Number(req.params.id);
    if (Number.isSafeInteger(id) && id > 0) await this.acesso.validar(req.user.id, id);
    return true;
  }
}
