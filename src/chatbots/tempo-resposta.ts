import { BadRequestException } from '@nestjs/common';
import type { ChatbotFlowGraph } from './entities/chatbot-flow-versions.entity';

export const SAIDA_SEM_RESPOSTA = 'sem-resposta';
export type ConfigTempoResposta = { replyTimeoutEnabled?: boolean; replyTimeoutMinutes?: number };

export function minutosDeEspera(data: ConfigTempoResposta): number | undefined {
  if (data.replyTimeoutEnabled === undefined || data.replyTimeoutEnabled === false) return undefined;
  if (data.replyTimeoutEnabled !== true || !Number.isInteger(data.replyTimeoutMinutes)
    || data.replyTimeoutMinutes < 1 || data.replyTimeoutMinutes > 10080) {
    throw new BadRequestException('O tempo limite de resposta deve ser de 1 a 10080 minutos');
  }
  return data.replyTimeoutMinutes;
}

export function validarTemposDeResposta(graph: ChatbotFlowGraph): void {
  for (const no of graph.nodes) {
    const minutos = minutosDeEspera(no.data);
    if (minutos === undefined) continue;
    if (no.type !== 'menu' && !(no.type === 'message' && no.data.continueOn === 'after_reply')) {
      throw new BadRequestException('Tempo limite só pode ser usado em Menu ou Mensagem com continuação Após resposta');
    }
    const ligacao = graph.edges.find(e => e.source === no.id && e.sourceHandle === SAIDA_SEM_RESPOSTA);
    if (!ligacao || !graph.nodes.some(n => n.id === ligacao.target)) {
      throw new BadRequestException('Conecte a saída Sem resposta de todos os nós com tempo limite antes de publicar');
    }
    if (Array.isArray(no.data.options) && no.data.options.some(o => o.id === SAIDA_SEM_RESPOSTA)
      || no.data.invalidOptionOutputHandle === SAIDA_SEM_RESPOSTA) {
      throw new BadRequestException('A saída Sem resposta é reservada ao tempo limite');
    }
  }
}
