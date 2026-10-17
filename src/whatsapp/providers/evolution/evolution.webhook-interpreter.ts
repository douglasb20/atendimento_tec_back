import { Logger } from '@nestjs/common';

import { DataTypeWhatsapp, WhatsappWebhookPayload } from '@types';
import { EvolutionMapper } from './evolution.mapper';
import { EvolutionWebhookBody } from './evolution.types';

/**
 * O que o `WhatsappService` precisa saber de um webhook, sem conhecer quem o
 * enviou.
 *
 * `payload` é `null` quando o evento é reconhecido mas não há o que aproveitar
 * (reação sem alvo, QR vazio, mensagem de grupo): o chamador descarta.
 */
export type WebhookInterpretado = {
  dataType: DataTypeWhatsapp;
  payload: WhatsappWebhookPayload | null;
  /** Chave do job na fila, já pronta para o BullMQ. */
  chaveDaFila: string;
  /** `true` manda o evento para a fila de sessão, não a de mensagens. */
  ehEventoDeSessao: boolean;
};

/**
 * Traduz o webhook da Evolution para o vocabulário da aplicação.
 *
 * Existe para que o `WhatsappService` não precise conhecer o formato de
 * nenhum provider: tudo que é específico da Evolution - nomes de evento,
 * formato do `data`, o que descartar - mora aqui dentro de
 * `providers/evolution/`. Trocar de gateway passa a ser escrever outro
 * interpretador, não reescrever o serviço.
 *
 * Classe de métodos estáticos, como o `EvolutionMapper` ao lado: não guarda
 * estado e não depende de injeção, o que também a deixa testável sozinha.
 */
export class EvolutionWebhookInterpreter {
  private static readonly logger = new Logger(EvolutionWebhookInterpreter.name);

  /**
   * O webhook inteiro, interpretado - ou `null` quando não há evento de
   * interesse (tipo desconhecido, ou mensagem só de controle do protocolo).
   */
  static interpretar(body: EvolutionWebhookBody): WebhookInterpretado | null {
    const dataType = this.resolveDataType(body);

    if (!dataType) {
      this.logger.debug(`Evento ignorado: ${body.event} (instância ${body.instance})`);
      return null;
    }

    // Mensagem de controle do protocolo, sem conteúdo para exibir: chega
    // junto de ações como editar/apagar feitas no celular e, sem este
    // descarte, virava uma bolha vazia na conversa (tipo `unknown`).
    if (dataType === DataTypeWhatsapp.MESSAGE_CREATE && this.ehMensagemDeControle(body)) {
      this.logger.debug(`Mensagem de controle ignorada (instância ${body.instance}).`);
      return null;
    }

    return {
      dataType,
      payload: this.normalizePayload(body, dataType),
      chaveDaFila: this.getChatKey(body, dataType),
      ehEventoDeSessao: this.isSessionEvent(dataType),
    };
  }

  /**
   * Mensagem sem nada a exibir: só nós de controle do protocolo.
   *
   * `secretEncryptedMessage` é o caso visto em produção - payload cifrado que
   * acompanha ações feitas no celular (editar, apagar, enquete) e que nem o
   * Baileys decifra. `messageContextInfo` sozinho é só metadado.
   */
  private static ehMensagemDeControle(body: EvolutionWebhookBody): boolean {
    const message = (body.data as { message?: Record<string, unknown> } | undefined)?.message;
    if (!message || typeof message !== 'object') return false;

    const soControle = ['messageContextInfo', 'secretEncryptedMessage', 'deviceSentMessage'];
    const chaves = Object.keys(message);

    return chaves.length > 0 && chaves.every((chave) => soControle.includes(chave));
  }

  /** Descobre o tipo interno; `connection.update` depende do estado recebido. */
  private static resolveDataType(body: EvolutionWebhookBody): DataTypeWhatsapp | null {
    const mapped = EvolutionMapper.mapEventType(body.event);

    if (mapped === DataTypeWhatsapp.STATE_CHANGED) {
      return EvolutionMapper.mapConnectionState(body.data as never);
    }

    // Reação chega como mensagem contendo reactionMessage.
    if (mapped === DataTypeWhatsapp.MESSAGE_CREATE && this.isReaction(body)) {
      return DataTypeWhatsapp.MESSAGE_REACTION;
    }

    return mapped;
  }

  /** Converte o `data` da Evolution para o formato que os handlers consomem. */
  private static normalizePayload(
    body: EvolutionWebhookBody,
    dataType: DataTypeWhatsapp,
  ): WhatsappWebhookPayload | null {
    const { data } = body;

    // Sem JID não há conversa a que vincular o evento: o mapper preencheria os
    // campos com string vazia e gravaria uma mensagem órfã. Descartar aqui,
    // como já se faz com reação, QR e contagem de não lidas.
    const exigeRemoteJid = [
      DataTypeWhatsapp.MESSAGE_CREATE,
      DataTypeWhatsapp.MESSAGE_EDIT,
      DataTypeWhatsapp.MESSAGE_ACK,
      DataTypeWhatsapp.MESSAGE_REVOKED_EVERYONE,
    ].includes(dataType);

    const remoteJid = exigeRemoteJid ? EvolutionMapper.extractRemoteJid(body.event, data) : null;

    if (exigeRemoteJid && !remoteJid) {
      this.logger.warn(
        `Evento ${body.event} sem remoteJid descartado (instância ${body.instance})`,
      );
      return null;
    }

    // Mensagem de grupo (`@g.us`): o sistema não tem tratamento de grupo -
    // "contato" é sempre uma pessoa, e o id do grupo (até 18 dígitos) não cabe
    // no `contacts.phone` nem faz sentido como telefone. Descartada aqui, e
    // não mais adiante, para nem abrir conversa nem tentar criar o contato.
    if (exigeRemoteJid && remoteJid?.endsWith('@g.us')) {
      this.logger.debug(`Evento ${body.event} de grupo descartado (${remoteJid})`);
      return null;
    }

    switch (dataType) {
      case DataTypeWhatsapp.MESSAGE_CREATE:
        return EvolutionMapper.toInternalPayload(body, dataType, {
          message: EvolutionMapper.mapUpsert(data as never),
        });

      case DataTypeWhatsapp.MESSAGE_EDIT:
        return EvolutionMapper.toInternalPayload(body, dataType, {
          message: EvolutionMapper.mapEdited(data as never),
        });

      case DataTypeWhatsapp.MESSAGE_ACK:
        return EvolutionMapper.toInternalPayload(body, dataType, {
          message: EvolutionMapper.mapUpdate(data as never),
        });

      case DataTypeWhatsapp.MESSAGE_REVOKED_EVERYONE:
        return EvolutionMapper.toInternalPayload(body, dataType, {
          message: EvolutionMapper.mapDeleted(data as never),
        });

      case DataTypeWhatsapp.MESSAGE_REACTION: {
        const reaction = EvolutionMapper.mapReaction(data as never);
        return reaction ? EvolutionMapper.toInternalPayload(body, dataType, { reaction }) : null;
      }

      case DataTypeWhatsapp.INCOMING_CALL: {
        const chamada = EvolutionMapper.mapCall(data);
        // Só a oferta interessa: `terminate` chega logo depois da nossa própria
        // rejeição e duplicaria o aviso na conversa. Grupo não tem atendimento.
        if (!chamada || chamada.status !== 'offer' || chamada.isGroup) return null;

        return EvolutionMapper.toInternalPayload(body, dataType, { chamada });
      }

      case DataTypeWhatsapp.QR_RECEIVED: {
        const { code, pairingCode } = EvolutionMapper.mapQrCode(data as never);
        return code || pairingCode
          ? EvolutionMapper.toInternalPayload(body, dataType, { qr: code, pairingCode })
          : null;
      }

      case DataTypeWhatsapp.UNREAD_COUNT: {
        const chat = Array.isArray(data) ? data[0] : data;
        const remoteJid =
          (chat as { remoteJid?: string; id?: string })?.remoteJid ?? (chat as { id?: string })?.id;
        if (!remoteJid) return null;

        return EvolutionMapper.toInternalPayload(body, dataType, {
          chat: {
            id: { _serialized: remoteJid },
            unreadCount: (chat as { unreadCount?: number })?.unreadCount ?? 0,
          },
        });
      }

      case DataTypeWhatsapp.READY:
      case DataTypeWhatsapp.DISCONNECTED:
      case DataTypeWhatsapp.AUTHENTICATED:
        return EvolutionMapper.toInternalPayload(body, dataType, data);

      default:
        return null;
    }
  }

  private static isReaction(body: EvolutionWebhookBody): boolean {
    const data = body.data as { message?: { reactionMessage?: unknown }; messageType?: string };
    return Boolean(data?.message?.reactionMessage) || data?.messageType === 'reactionMessage';
  }

  private static isSessionEvent(dataType: DataTypeWhatsapp): boolean {
    return [
      DataTypeWhatsapp.QR_RECEIVED,
      DataTypeWhatsapp.AUTHENTICATED,
      DataTypeWhatsapp.READY,
      DataTypeWhatsapp.DISCONNECTED,
    ].includes(dataType);
  }

  /**
   * Chave do job. O formato agrupa por conversa e mantém a unicidade por
   * evento, preservando a ordenação garantida pela concorrência 1 do processor.
   */
  private static getChatKey(body: EvolutionWebhookBody, dataType: DataTypeWhatsapp): string {
    const remoteJid = EvolutionMapper.extractRemoteJid(body.event, body.data);

    if (!remoteJid) {
      return `${body.instance}-${dataType}_${Date.now()}`;
    }

    // O BullMQ recusa `:` no jobId, e o JID pode trazer sufixo de dispositivo
    // (`222226020307023:45@lid`). Trocar por `-` mantém a chave estável por
    // conversa, que é o que garante a ordenação.
    return `${body.instance}-${remoteJid.replace(/:/g, '-')}_${Date.now()}`;
  }
}
