import { Injectable } from '@nestjs/common';
import { lerDestinoEncaminhamento } from '@/chatbots/encaminhamento-atendimento';
import { NodeExecutionContext, NodeHandler, NodeResult } from './node-handler.interface';

@Injectable()
export class HandoffHandler implements NodeHandler {
  readonly type = 'handoff';

  async execute(ctx: NodeExecutionContext): Promise<NodeResult> {
    return { kind: 'handoff', ...lerDestinoEncaminhamento(ctx.node.data) };
  }
}
