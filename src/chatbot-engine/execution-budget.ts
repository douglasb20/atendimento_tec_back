import { BadRequestException } from '@nestjs/common';

/**
 * Limites de segurança por execução - protege contra loop infinito e custo
 * descontrolado (chamadas de API, transições automáticas, profundidade de
 * subfluxo). Consumido só pelo loop do motor, nunca pelos handlers
 * individualmente: um handler novo não precisa saber que limites existem.
 *
 * Valores default a validar com o usuário (ver plano, "Riscos e decisões em
 * aberto") - por ora, números conservadores o bastante para não travar um
 * fluxo legítimo, mas que pegam um loop claramente errado.
 */
export type ExecutionLimits = {
  maxTransitions: number;
  maxApiCalls: number;
  maxCallStackDepth: number;
};

export const LIMITES_PADRAO: ExecutionLimits = {
  maxTransitions: 200,
  maxApiCalls: 20,
  maxCallStackDepth: 10,
};

export class ExecutionLimitExceeded extends BadRequestException {
  constructor(public readonly code: string) {
    super(`Limite de execução excedido: ${code}`);
  }
}

export class ExecutionBudget {
  constructor(
    private readonly counters: Record<string, number>,
    private readonly limits: ExecutionLimits = LIMITES_PADRAO,
  ) {}

  consumeTransition(): void {
    this.counters.transitions_used = (this.counters.transitions_used ?? 0) + 1;

    if (this.counters.transitions_used > this.limits.maxTransitions) {
      throw new ExecutionLimitExceeded('max_transitions');
    }
  }

  consumeApiCall(): void {
    this.counters.api_calls_used = (this.counters.api_calls_used ?? 0) + 1;

    if (this.counters.api_calls_used > this.limits.maxApiCalls) {
      throw new ExecutionLimitExceeded('max_api_calls');
    }
  }

  assertStackDepth(depth: number): void {
    if (depth > this.limits.maxCallStackDepth) {
      throw new ExecutionLimitExceeded('max_call_stack_depth');
    }
  }

  /** O estado atual dos contadores, para persistir junto da execução. */
  snapshot(): Record<string, number> {
    return { ...this.counters };
  }
}
