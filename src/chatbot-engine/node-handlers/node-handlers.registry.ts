import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';

import { NODE_HANDLERS, NodeHandler } from './node-handler.interface';

/**
 * Resolve o handler certo pelo `type` do nó - Strategy pattern via DI, nunca
 * um switch central. Adicionar um tipo de nó novo é criar um provider e
 * incluí-lo no array de `NODE_HANDLERS` do módulo; nada aqui muda.
 */
@Injectable()
export class NodeHandlersRegistry {
  private readonly porTipo = new Map<string, NodeHandler>();

  constructor(@Inject(NODE_HANDLERS) handlers: NodeHandler[]) {
    for (const handler of handlers) {
      this.porTipo.set(handler.type, handler);
    }
  }

  resolve(type: string): NodeHandler {
    const handler = this.porTipo.get(type);

    if (!handler) {
      throw new InternalServerErrorException(`Nenhum handler registrado para o tipo de nó "${type}"`);
    }

    return handler;
  }
}
