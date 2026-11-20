import { Injectable, Logger } from '@nestjs/common';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, Message } from 'firebase-admin/messaging';

/** O que o push leva: o app usa `chatId` para abrir a conversa ao tocar. */
export type Aviso = { titulo: string; texto: string; chatId: number; tipo: 'mensagem' | 'transferencia' };

/** Canal do Android criado pelo app (`features/notifications/canal.ts`). */
const CANAL = 'conversas';
const NOME_APP = 'push';
/** Limite do Firebase por chamada de `sendEach`. */
const LOTE = 500;
const TOKEN_INVALIDO = ['registration-token-not-registered', 'invalid-registration-token'];

/**
 * A mensagem do Firebase para um celular. A `tag` faz o Android **trocar** o
 * aviso anterior da mesma conversa em vez de empilhar (um por conversa, como o
 * WhatsApp); é por ela que o envio não passa pelo serviço do Expo.
 */
export function mensagemDoAviso(token: string, aviso: Aviso): Message {
  const tag = `chat-${aviso.chatId}`;
  return {
    token,
    notification: { title: aviso.titulo, body: aviso.texto },
    android: { priority: 'high', notification: { tag, channelId: CANAL } },
    // A tag vai também nos dados: com o app aberto quem monta o aviso é o
    // expo-notifications, que usa `data.tag` como id (senão empilhava).
    data: { tipo: aviso.tipo, chatId: String(aviso.chatId), tag },
  };
}

/**
 * Cliente do Firebase Cloud Messaging.
 *
 * A credencial vem de `FIREBASE_CREDENTIALS_BASE64` (o JSON da conta de
 * serviço em base64). Sem ela o push fica desligado com um aviso no log, e o
 * resto do back segue normal: ambiente de teste não precisa de Firebase.
 */
@Injectable()
export class EnvioFirebase {
  private readonly logger = new Logger(EnvioFirebase.name);
  private readonly app: App | null = this.iniciar();

  get ativo(): boolean {
    return this.app !== null;
  }

  private iniciar(): App | null {
    const credencial = process.env.FIREBASE_CREDENTIALS_BASE64;
    if (!credencial) {
      this.logger.warn('FIREBASE_CREDENTIALS_BASE64 ausente: push do app desligado');
      return null;
    }
    try {
      const existente = getApps().find((a) => a.name === NOME_APP);
      if (existente) return existente;
      const conta = JSON.parse(Buffer.from(credencial, 'base64').toString('utf8'));
      return initializeApp({ credential: cert(conta) }, NOME_APP);
    } catch (erro) {
      this.logger.error(`Credencial do Firebase inválida, push desligado: ${(erro as Error).message}`);
      return null;
    }
  }

  /** Envia o aviso e devolve os tokens que o Firebase diz não existirem mais. */
  async enviar(tokens: string[], aviso: Aviso): Promise<{ invalidos: string[] }> {
    if (!this.app || !tokens.length) return { invalidos: [] };
    const invalidos: string[] = [];
    for (let i = 0; i < tokens.length; i += LOTE) {
      const lote = tokens.slice(i, i + LOTE);
      const resposta = await getMessaging(this.app).sendEach(lote.map((t) => mensagemDoAviso(t, aviso)));
      resposta.responses.forEach((r, j) => {
        const codigo = r.error?.code ?? '';
        if (TOKEN_INVALIDO.some((c) => codigo.endsWith(c))) invalidos.push(lote[j]);
        else if (r.error) this.logger.warn(`Push não entregue (${codigo})`);
      });
    }
    return { invalidos };
  }
}
