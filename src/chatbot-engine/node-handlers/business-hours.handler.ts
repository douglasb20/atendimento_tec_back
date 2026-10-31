import { Injectable } from '@nestjs/common';
import { DisponibilidadeSetorService } from '@/departments/disponibilidade-setor.service';
import { NodeExecutionContext, NodeHandler, NodeResult } from './node-handler.interface';

@Injectable()
export class BusinessHoursHandler implements NodeHandler {
  readonly type = 'business_hours';
  constructor(private readonly disponibilidade: DisponibilidadeSetorService) {}

  async execute(ctx: NodeExecutionContext): Promise<NodeResult> {
    const setorId = Number(ctx.node.data.department_id);
    if (!Number.isSafeInteger(setorId) || setorId <= 0) throw new Error('Escolha o setor no nó Verificar horário do setor');
    const resultado = await this.disponibilidade.verificar(setorId);
    return { kind: 'continue', outputHandle: resultado.disponivel ? 'inside' : 'outside' };
  }
}
