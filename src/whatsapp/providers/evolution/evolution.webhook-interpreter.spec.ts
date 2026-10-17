import { DataTypeWhatsapp } from '@types';
import { EvolutionWebhookBody } from './evolution.types';
import { EvolutionWebhookInterpreter } from './evolution.webhook-interpreter';

/**
 * O contrato do interpretador - as regras que decidem se um evento do WhatsApp
 * vira mensagem, em que fila entra e o que é descartado.
 *
 * Sem NestJS e sem entidades, como o `evolution.mapper.spec.ts` ao lado: a
 * classe é estática e não depende de injeção, então o teste roda sem subir
 * módulo nenhum (ver `testes-jest-esm-e-ciclos`).
 */
describe('EvolutionWebhookInterpreter', () => {
  /** Envelope mínimo de uma mensagem recebida. */
  const mensagem = (data: Record<string, unknown> = {}): EvolutionWebhookBody =>
    ({
      event: 'messages.upsert',
      instance: 'canal-teste',
      data: {
        key: { remoteJid: '5564999999999@s.whatsapp.net', fromMe: false, id: 'MSG1' },
        pushName: 'Fulano',
        messageTimestamp: 1700000000,
        message: { conversation: 'oi' },
        ...data,
      },
    }) as EvolutionWebhookBody;

  describe('o que entra', () => {
    it('reconhece mensagem recebida e manda para a fila de mensagens', () => {
      const r = EvolutionWebhookInterpreter.interpretar(mensagem());

      expect(r?.dataType).toBe(DataTypeWhatsapp.MESSAGE_CREATE);
      expect(r?.payload).not.toBeNull();
      expect(r?.ehEventoDeSessao).toBe(false);
    });

    it('manda evento de QR para a fila de sessão', () => {
      const r = EvolutionWebhookInterpreter.interpretar({
        event: 'qrcode.updated',
        instance: 'canal-teste',
        data: { qrcode: { code: 'QR-AQUI', pairingCode: null } },
      } as EvolutionWebhookBody);

      expect(r?.dataType).toBe(DataTypeWhatsapp.QR_RECEIVED);
      expect(r?.ehEventoDeSessao).toBe(true);
    });

    it('distingue reação de mensagem nova', () => {
      const r = EvolutionWebhookInterpreter.interpretar(
        mensagem({
          message: { reactionMessage: { key: { id: 'MSG0' }, text: '👍' } },
          messageType: 'reactionMessage',
        }),
      );

      expect(r?.dataType).toBe(DataTypeWhatsapp.MESSAGE_REACTION);
    });
  });

  describe('o que é descartado', () => {
    it('evento de tipo desconhecido', () => {
      expect(
        EvolutionWebhookInterpreter.interpretar({
          event: 'evento.que.nao.assinamos',
          instance: 'canal-teste',
          data: {},
        } as EvolutionWebhookBody),
      ).toBeNull();
    });

    it('mensagem só com nós de controle do protocolo', () => {
      const r = EvolutionWebhookInterpreter.interpretar(
        mensagem({ message: { messageContextInfo: {}, secretEncryptedMessage: {} } }),
      );

      // Sem este descarte virava uma bolha vazia na conversa.
      expect(r).toBeNull();
    });

    it('mensagem de grupo', () => {
      const r = EvolutionWebhookInterpreter.interpretar(
        mensagem({ key: { remoteJid: '123456789@g.us', fromMe: false, id: 'MSG2' } }),
      );

      // O tipo é reconhecido, mas não há payload: o sistema não trata grupo.
      expect(r?.dataType).toBe(DataTypeWhatsapp.MESSAGE_CREATE);
      expect(r?.payload).toBeNull();
    });

    it('mensagem sem remoteJid', () => {
      const r = EvolutionWebhookInterpreter.interpretar(
        mensagem({ key: { fromMe: false, id: 'MSG3' } }),
      );

      expect(r?.payload).toBeNull();
    });
  });

  describe('chave da fila', () => {
    it('agrupa por conversa e troca ":" por "-"', () => {
      const r = EvolutionWebhookInterpreter.interpretar(
        mensagem({ key: { remoteJid: '222226020307023:45@lid', fromMe: false, id: 'MSG4' } }),
      );

      // O BullMQ recusa `:` no jobId; a chave precisa ficar estável por
      // conversa, que é o que garante a ordenação.
      expect(r?.chaveDaFila).toContain('222226020307023-45@lid');
      expect(r?.chaveDaFila).not.toContain(':');
    });

    it('usa a instância e o tipo quando não há remoteJid', () => {
      const r = EvolutionWebhookInterpreter.interpretar({
        event: 'qrcode.updated',
        instance: 'canal-teste',
        data: { qrcode: { code: 'QR', pairingCode: null } },
      } as EvolutionWebhookBody);

      expect(r?.chaveDaFila).toContain('canal-teste');
    });
  });
});
