import { Injectable } from '@nestjs/common';

import { HolidaysService } from '@/holidays/holidays.service';
import { NodeExecutionContext, NodeHandler, NodeResult } from './node-handler.interface';

type HolidayData = {
  /** Saídas fixas, sempre presentes no grafo. */
  holidayOutputHandle: string;
  notHolidayOutputHandle: string;
};

/**
 * Verifica se hoje é feriado (cadastro em `holidays`) e segue por uma de duas
 * saídas fixas. Único nó do motor que consulta outro módulo - leitura
 * simples, não precisa rodar na transação do `ExecutionEngine`.
 */
@Injectable()
export class HolidayHandler implements NodeHandler {
  readonly type = 'holiday';

  constructor(private readonly holidaysService: HolidaysService) {}

  async execute(ctx: NodeExecutionContext): Promise<NodeResult> {
    const data = ctx.node.data as unknown as HolidayData;
    const ehFeriado = await this.holidaysService.ehFeriadoHoje();

    return {
      kind: 'continue',
      outputHandle: ehFeriado ? data.holidayOutputHandle : data.notHolidayOutputHandle,
    };
  }
}
