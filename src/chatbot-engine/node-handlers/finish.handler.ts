import { Injectable } from '@nestjs/common';

import { NodeHandler, NodeResult } from './node-handler.interface';

/**
 * Encerra o fluxo (ou, dentro de um subfluxo, devolve o controle ao pai - é o
 * `ExecutionEngine` quem decide isso, olhando a `call_stack`; este handler só
 * sinaliza "terminei aqui").
 */
@Injectable()
export class FinishHandler implements NodeHandler {
  readonly type = 'finish';

  async execute(): Promise<NodeResult> {
    return { kind: 'finish' };
  }
}
