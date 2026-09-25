import { Injectable } from '@nestjs/common';

import { NodeExecutionContext, NodeHandler, NodeResult } from './node-handler.interface';

type Condicao = {
  /** Vira o `sourceHandle` da edge escolhida quando esta condição bate. */
  id: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
  term: string;
};

type ConditionalData = {
  /** 'last_message' lê a última resposta do contato; 'variable' lê `variable`. */
  compareUsing: 'last_message' | 'variable';
  variable?: string;
  conditions: Condicao[];
  /** Saída usada quando nenhuma condição bate - sempre presente no grafo. */
  defaultOutputHandle: string;
};

/**
 * Avalia condições em ordem contra um valor (mensagem recebida ou variável) e
 * segue pela primeira que bater - um switch/case. Cada condição é uma saída
 * própria do nó (`sourceHandle` = `condicao.id`); sem match, segue pela saída
 * padrão. Não faz I/O - só lê `variables`.
 */
@Injectable()
export class ConditionalHandler implements NodeHandler {
  readonly type = 'conditional';

  async execute(ctx: NodeExecutionContext): Promise<NodeResult> {
    const data = ctx.node.data as unknown as ConditionalData;

    const valor = String(
      data.compareUsing === 'variable'
        ? (ctx.variables.get(data.variable ?? '') ?? '')
        : (ctx.variables.get('_last_message') ?? ''),
    );

    for (const condicao of data.conditions) {
      if (this.bate(valor, condicao)) {
        return { kind: 'continue', outputHandle: condicao.id };
      }
    }

    return { kind: 'continue', outputHandle: data.defaultOutputHandle };
  }

  private bate(valor: string, condicao: Condicao): boolean {
    const termo = condicao.term;

    switch (condicao.operator) {
      case 'equals':
        return valor.trim().toLowerCase() === termo.trim().toLowerCase();
      case 'contains':
        return valor.toLowerCase().includes(termo.toLowerCase());
      case 'greater_than':
        return Number(valor) > Number(termo);
      case 'less_than':
        return Number(valor) < Number(termo);
      default:
        return false;
    }
  }
}
