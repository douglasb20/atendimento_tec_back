import { BadRequestException } from '@nestjs/common';
import type { ChatbotFlowGraph } from './entities/chatbot-flow-versions.entity';

/** A âncora do fluxo não é um bloco editável, inclusive para chamadas diretas à API. */
export function validarInicioFixo(graph: ChatbotFlowGraph, anterior?: ChatbotFlowGraph): void {
  const inicios = graph.nodes.filter(no => no.type === 'start');
  if (inicios.length !== 1) throw new BadRequestException('O fluxo deve manter exatamente um nó Início; ele não pode ser removido');
  const inicio = inicios[0];
  if (!inicio.id || !inicio.position || !Number.isFinite(inicio.position.x) || !Number.isFinite(inicio.position.y)) {
    throw new BadRequestException('O nó Início precisa de um identificador e uma posição válidos');
  }
  if (graph.nodes.filter(no => no.id === inicio.id).length !== 1) throw new BadRequestException('O identificador do nó Início não pode ser compartilhado com outro nó');
  const original = anterior?.nodes.find(no => no.type === 'start');
  if (!original?.id || !original.position || !Number.isFinite(original.position.x) || !Number.isFinite(original.position.y)) return;
  if (inicio.id !== original.id) throw new BadRequestException('O nó Início não pode ser substituído');
  if (inicio.position.x !== original.position.x || inicio.position.y !== original.position.y) {
    throw new BadRequestException('O nó Início é fixo e não pode ser movido');
  }
}
