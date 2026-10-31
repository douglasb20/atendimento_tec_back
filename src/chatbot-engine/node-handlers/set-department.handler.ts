import { Injectable } from '@nestjs/common';
import { NodeExecutionContext, NodeHandler, NodeResult } from './node-handler.interface';

@Injectable()
export class SetDepartmentHandler implements NodeHandler {
  readonly type = 'set_department';
  async execute(ctx: NodeExecutionContext): Promise<NodeResult> {
    const setorId = Number(ctx.node.data.department_id);
    if (!Number.isSafeInteger(setorId) || setorId <= 0) throw new Error('Escolha o setor no nó Definir setor');
    return { kind: 'continue', outputHandle: null, departmentId: setorId };
  }
}
