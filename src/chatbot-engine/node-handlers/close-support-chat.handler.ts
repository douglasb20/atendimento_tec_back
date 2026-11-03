import { Injectable } from '@nestjs/common';

import { NodeExecutionContext, NodeHandler, NodeResult } from './node-handler.interface';

type CloseSupportChatData = {
  enviarDespedida?: boolean;
  executarFluxoSaida?: boolean;
};

/**
 * Encerra a conversa de atendimento criada pelo chatbot. Diferente de
 * `finish`, este nó encerra também o ticket e pode iniciar o pós-atendimento.
 */
@Injectable()
export class CloseSupportChatHandler implements NodeHandler {
  readonly type = 'close_support_chat';

  async execute(ctx: NodeExecutionContext): Promise<NodeResult> {
    const data = ctx.node.data as CloseSupportChatData;
    return { kind: 'close_support_chat', enviarDespedida: data.enviarDespedida ?? true,
      executarFluxoSaida: data.executarFluxoSaida === true };
  }
}
