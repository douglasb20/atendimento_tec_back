import { BadRequestException } from '@nestjs/common';
import type { ChatbotFlowGraph } from './entities/chatbot-flow-versions.entity';
import { SAIDA_SEM_RESPOSTA } from './tempo-resposta';

export const SAIDA_LIMITE_TENTATIVAS = 'limite-tentativas';
export type AcaoOpcaoInvalida = 'repeat_menu' | 'wait_reply' | 'follow_output';
export type ConfigTentativasMenu = {
  invalidAttemptLimitEnabled?: boolean;
  maxInvalidAttempts?: number;
  invalidOptionAction?: AcaoOpcaoInvalida;
};

export function acaoOpcaoInvalida(data: ConfigTentativasMenu): AcaoOpcaoInvalida {
  // Ausente em fluxos antigos: não altera as ligações que já estavam em uso.
  if (data.invalidOptionAction === undefined) return 'follow_output';
  if (!['repeat_menu', 'wait_reply', 'follow_output'].includes(data.invalidOptionAction)) {
    throw new BadRequestException('Escolha uma ação válida para a opção inválida do Menu');
  }
  return data.invalidOptionAction;
}

export function limiteDeTentativas(data: ConfigTentativasMenu): number | undefined {
  if (data.invalidAttemptLimitEnabled === undefined || data.invalidAttemptLimitEnabled === false) return undefined;
  if (data.invalidAttemptLimitEnabled !== true || !Number.isInteger(data.maxInvalidAttempts)
    || data.maxInvalidAttempts < 1 || data.maxInvalidAttempts > 10) {
    throw new BadRequestException('O limite de tentativas inválidas deve ser de 1 a 10');
  }
  return data.maxInvalidAttempts;
}

export function validarTentativasMenu(graph: ChatbotFlowGraph): void {
  for (const no of graph.nodes) {
    const limite = limiteDeTentativas(no.data);
    const acao = acaoOpcaoInvalida(no.data);
    if (limite === undefined && no.data.invalidOptionAction === undefined) continue;
    if (no.type !== 'menu') throw new BadRequestException('Ação de opção inválida e limite de tentativas só podem ser usados no nó Menu');
    const invalida = typeof no.data.invalidOptionOutputHandle === 'string' ? no.data.invalidOptionOutputHandle : 'invalid';
    if ([SAIDA_LIMITE_TENTATIVAS, SAIDA_SEM_RESPOSTA].includes(invalida)
      || Array.isArray(no.data.options) && no.data.options.some(opcao => [invalida, SAIDA_LIMITE_TENTATIVAS, SAIDA_SEM_RESPOSTA].includes(opcao.id))) {
      throw new BadRequestException('As saídas de controle do Menu são reservadas e não podem ser usadas como opções');
    }
    const saidas: string[][] = [];
    if (limite !== undefined) saidas.push([SAIDA_LIMITE_TENTATIVAS, 'Excesso de tentativas']);
    if (acao === 'follow_output' && (limite === undefined || limite > 1)) saidas.push([invalida, 'Opção inválida']);
    for (const [handle, nome] of saidas) {
      const ligacao = graph.edges.find(aresta => aresta.source === no.id && aresta.sourceHandle === handle);
      if (!ligacao || !graph.nodes.some(destino => destino.id === ligacao.target)) {
        throw new BadRequestException(`Conecte a saída ${nome} do Menu antes de publicar`);
      }
    }
  }
}
