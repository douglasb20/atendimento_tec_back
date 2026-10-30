import { Injectable } from '@nestjs/common';

import { ProviderMediaType } from '@/whatsapp/providers/whatsapp-provider.interface';
import { NodeEffect, NodeExecutionContext, NodeHandler, NodeResult } from './node-handler.interface';

type MessageType = 'text' | ProviderMediaType;

type MessageNodeData = {
  messageType?: MessageType;
  value?: string;
  attachmentSource?: 'upload' | 'variable';
  attachmentKey?: string;
  attachmentFileName?: string;
  attachmentMimetype?: string;
  attachmentVariable?: string;
  continueOn?: 'auto' | 'after_reply';
  simulateTyping?: boolean;
  typingDelaySeconds?: number;
};

/**
 * Envia texto ou mídia e, conforme "Continuar", segue direto ou espera
 * resposta do contato antes de avançar. O envio de fato roda fora deste
 * handler: ele só descreve o efeito, que o motor dispara depois do commit.
 */
@Injectable()
export class MessageHandler implements NodeHandler {
  readonly type = 'message';

  async execute(ctx: NodeExecutionContext): Promise<NodeResult> {
    const data = ctx.node.data as MessageNodeData;
    const messageType = data.messageType ?? 'text';

    if (data.continueOn === 'after_reply') {
      // Na retomada, a mensagem deste nó já foi enviada antes da suspensão.
      // Não pode ser montada/enviada outra vez: basta seguir a saída única
      // para o próximo nó com a resposta já disponível em `_last_message`.
      if (ctx.resumePayload) {
        return { kind: 'continue', outputHandle: null };
      }

      const effects = this.montaEfeitos(data, messageType, ctx);
      return { kind: 'suspend', waitingFor: { type: 'contact_reply', node_id: ctx.node.id }, effects };
    }

    return { kind: 'continue', outputHandle: null, effects: this.montaEfeitos(data, messageType, ctx) };
  }

  private montaEfeitos(
    data: MessageNodeData,
    messageType: MessageType,
    ctx: NodeExecutionContext,
  ): NodeEffect[] {
    const texto = ctx.variables.interpolate(String(data.value ?? ''));
    const typingDelayMs = this.resolveTempoDigitacao(data);

    if (messageType === 'text') {
      return texto ? [{ type: 'send_text', text: texto, typingDelayMs }] : [];
    }

    // Origem "variável": o próprio valor interpolado é a URL/data URI/base64
    // do anexo - não passa pelo storage do chatbot, então não há key
    // permanente nem cópia a fazer (é o `ExecutionEngine` quem distingue,
    // pela ausência de prefixo de storage, se precisa copiar ou não).
    const mediaKey =
      data.attachmentSource === 'variable'
        ? ctx.variables.interpolate(String(data.attachmentVariable ?? ''))
        : String(data.attachmentKey ?? '');

    if (!mediaKey) return [];

    const fileName =
      data.attachmentSource === 'variable'
        ? ctx.variables.interpolate(String(data.attachmentFileName ?? ''))
        : data.attachmentFileName;

    const mimetype =
      data.attachmentSource === 'variable'
        ? ctx.variables.interpolate(String(data.attachmentMimetype ?? ''))
        : data.attachmentMimetype;

    return [
      {
        type: 'send_media',
        mediaType: messageType,
        mediaKey,
        mimetype: mimetype || undefined,
        fileName: fileName || undefined,
        caption: texto || undefined,
        typingDelayMs,
      },
    ];
  }

  private resolveTempoDigitacao(data: MessageNodeData): number | undefined {
    if (!data.simulateTyping) return undefined;

    const segundos = Number(data.typingDelaySeconds ?? 2);
    const segundosValidos = Number.isFinite(segundos) ? Math.min(Math.max(segundos, 1), 10) : 2;
    return Math.round(segundosValidos * 1000);
  }
}
