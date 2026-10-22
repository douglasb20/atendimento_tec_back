import { Injectable } from '@nestjs/common';

import { NodeExecutionContext, NodeHandler, NodeResult } from './node-handler.interface';

type MenuOption = {
  /** Vira o `sourceHandle` da edge escolhida quando esta opção é selecionada. */
  id: string;
  emoji?: string;
  text: string;
};

type MenuData = {
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
 * match, segue pela saída "opção inválida" (quem decide reenviar o menu ou
 * encerrar é o fluxo, não o motor - evita loop embutido aqui).
 */
@Injectable()
export class MenuHandler implements NodeHandler {
  readonly type = 'menu';

  async execute(ctx: NodeExecutionContext): Promise<NodeResult> {
    const data = ctx.node.data as unknown as MenuData;

    if (!ctx.resumePayload) {
      const texto = this.montaTexto(data, ctx);
      return {
        kind: 'suspend',
        waitingFor: { type: 'contact_reply', node_id: ctx.node.id },
        effects: texto ? [{ type: 'send_text', text: texto }] : [],
      };
    }

    const resposta = String(ctx.variables.get('_last_message') ?? '').trim();
    const opcao = this.resolveOpcao(data.options, resposta);

    return { kind: 'continue', outputHandle: opcao?.id ?? data.invalidOptionOutputHandle };
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
