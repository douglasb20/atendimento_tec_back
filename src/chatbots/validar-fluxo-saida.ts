import { BadRequestException } from '@nestjs/common';
import type { ChatbotFlowGraph } from './entities/chatbot-flow-versions.entity';
import { minutosDeEspera, validarTemposDeResposta } from './tempo-resposta';
import { validarTentativasMenu } from './tentativas-menu';

/** O pós-atendimento não pode ficar aberto indefinidamente nem reescrever o setor histórico. */
export function validarFluxoSaida(graph: ChatbotFlowGraph): void {
  validarTemposDeResposta(graph);
  validarTentativasMenu(graph);
  for (const no of graph.nodes) {
    if (no.type === 'handoff') throw new BadRequestException('O fluxo de saída não pode encaminhar um atendimento já encerrado para atendimento humano');
    if (no.type === 'set_department') throw new BadRequestException('O fluxo de saída não pode alterar o setor do atendimento encerrado');
    if ((no.type === 'menu' || no.type === 'message' && no.data.continueOn === 'after_reply') && !minutosDeEspera(no.data)) {
      throw new BadRequestException('Configure o tempo limite e a saída Sem resposta nos nós do fluxo de saída que aguardam o cliente');
    }
  }
}
