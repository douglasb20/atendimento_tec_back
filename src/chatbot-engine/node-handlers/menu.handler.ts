import { Injectable } from '@nestjs/common';
import { ConfigTempoResposta, minutosDeEspera, SAIDA_SEM_RESPOSTA } from '@/chatbots/tempo-resposta';
import { acaoOpcaoInvalida, ConfigTentativasMenu, limiteDeTentativas, SAIDA_LIMITE_TENTATIVAS } from '@/chatbots/tentativas-menu';

import { NodeExecutionContext, NodeHandler, NodeResult } from './node-handler.interface';

type MenuOption = {
  /** Vira o `sourceHandle` da edge escolhida quando esta opção é selecionada. */
  id: string;
  emoji?: string;
  text: string;
};

type MenuData = ConfigTempoResposta & ConfigTentativasMenu & {
  title?: string;
  body?: string;
  options: MenuOption[];
  /** Saída usada quando a resposta não casa com nenhuma opção - sempre presente no grafo. */
  invalidOptionOutputHandle: string;
};

/**
 * Envia o menu (título + corpo + opções numeradas) e suspende esperando a
 * resposta do contato - mesma suspensão do nó Mensagem em "Após resposta". Na
 * retomada, casa a resposta por número (1-based) ou pelo texto da opção; sem
 * match, aplica a ação configurada. Reenviar/aguardar cria outra suspensão,
 * nunca um loop automático. O excesso tem prioridade sobre a ação de erro.
 */
@Injectable()
export class MenuHandler implements NodeHandler {
  readonly type = 'menu';

  async execute(ctx: NodeExecutionContext): Promise<NodeResult> {
    const data = ctx.node.data as unknown as MenuData;
    const limite = limiteDeTentativas(data);
    const acao = acaoOpcaoInvalida(data);

    if (!ctx.resumePayload) {
      return this.aguardarResposta(data, ctx, this.montaTexto(data, ctx));
    }

    const resposta = String(ctx.variables.get('_last_message') ?? '').trim();
    const opcao = this.resolveOpcao(data.options, resposta);

    if (limite !== undefined) {
      const salvo = ctx.variables.get('_menu_tentativas_invalidas');
      const contagens = salvo && typeof salvo === 'object' && !Array.isArray(salvo)
        ? { ...salvo } as Record<string, number> : {};
      const chave = `${ctx.flowVersionId ?? 'principal'}:${ctx.node.id}`;
      const anterior = Number.isSafeInteger(contagens[chave]) && contagens[chave] > 0 ? contagens[chave] : 0;
      const tentativas = opcao ? 0 : anterior + 1;
      if (opcao || tentativas >= limite) delete contagens[chave];
      else contagens[chave] = tentativas;
      ctx.variables.set('_menu_tentativas_invalidas', contagens);
      if (!opcao && tentativas >= limite) return { kind: 'continue', outputHandle: SAIDA_LIMITE_TENTATIVAS };
    }

    if (opcao) return { kind: 'continue', outputHandle: opcao.id };
    if (acao === 'follow_output') return { kind: 'continue', outputHandle: data.invalidOptionOutputHandle ?? 'invalid' };
    return this.aguardarResposta(data, ctx, acao === 'repeat_menu' ? this.montaTexto(data, ctx) : '');
  }

  private aguardarResposta(data: MenuData, ctx: NodeExecutionContext, texto: string): NodeResult {
    return { kind: 'suspend', waitingFor: { type: 'contact_reply', node_id: ctx.node.id,
      timeout_minutes: minutosDeEspera(data), timeout_handle: SAIDA_SEM_RESPOSTA },
    effects: texto ? [{ type: 'send_text', text: texto }] : [] };
  }

  private montaTexto(data: MenuData, ctx: NodeExecutionContext): string {
    const partes: string[] = [];

    if (data.title) partes.push(ctx.variables.interpolate(data.title));
    if (data.body) partes.push(ctx.variables.interpolate(data.body));

    data.options.forEach((opcao, indice) => {
      const emoji = opcao.emoji ? `${opcao.emoji} ` : '';
      partes.push(`${indice + 1}. ${emoji}${ctx.variables.interpolate(opcao.text)}`);
    });

    return partes.join('\n');
  }

  private resolveOpcao(options: MenuOption[], resposta: string): MenuOption | undefined {
    const numero = Number(resposta);
    if (Number.isInteger(numero) && numero >= 1 && numero <= options.length) {
      return options[numero - 1];
    }

    const respostaNormalizada = resposta.toLowerCase();
    return options.find((opcao) => opcao.text.trim().toLowerCase() === respostaNormalizada);
  }
}
