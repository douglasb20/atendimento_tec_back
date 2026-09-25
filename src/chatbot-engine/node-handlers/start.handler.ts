import { Injectable } from '@nestjs/common';

import { NodeHandler, NodeResult } from './node-handler.interface';

/** O nó Início - não faz nada, só segue para o primeiro nó real do fluxo. */
@Injectable()
export class StartHandler implements NodeHandler {
  readonly type = 'start';

  async execute(): Promise<NodeResult> {
    return { kind: 'continue', outputHandle: null };
  }
}
