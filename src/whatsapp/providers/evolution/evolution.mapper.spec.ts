import { DataTypeWhatsapp, MessageAck, MessageTypes } from '@types';
import { EvolutionMapper } from './evolution.mapper';
import {
  EvolutionDeleteData,
  EvolutionQrCodeData,
  EvolutionUpdateData,
  EvolutionUpsertData,
} from './evolution.types';

/**
 * As fixtures reproduzem o formato real da Evolution API v2.3.7, conforme o
 * código-fonte dela (`prepareMessage` em whatsapp.baileys.service.ts). São o
 * contrato desta migração: se a Evolution mudar o shape, é aqui que quebra.
 */

const upsertTexto: EvolutionUpsertData = {
  key: {
    remoteJid: '554199999999@s.whatsapp.net',
    fromMe: false,
    id: '3EB0C767D26A1D9B6E5F',
  },
  pushName: 'João da Silva',
  status: 'DELIVERY_ACK',
  message: { conversation: 'Bom dia, preciso de suporte' },
  messageType: 'conversation',
  messageTimestamp: 1767390103,
  source: 'android',
};

describe('EvolutionMapper', () => {
  describe('mapEventType', () => {
    it('mapeia os eventos de mensagem para os tipos internos', () => {
      expect(EvolutionMapper.mapEventType('messages.upsert')).toBe(DataTypeWhatsapp.MESSAGE_CREATE);
      expect(EvolutionMapper.mapEventType('send.message')).toBe(DataTypeWhatsapp.MESSAGE_CREATE);
      expect(EvolutionMapper.mapEventType('messages.update')).toBe(DataTypeWhatsapp.MESSAGE_ACK);
      expect(EvolutionMapper.mapEventType('messages.edited')).toBe(DataTypeWhatsapp.MESSAGE_EDIT);
      expect(EvolutionMapper.mapEventType('messages.delete')).toBe(
        DataTypeWhatsapp.MESSAGE_REVOKED_EVERYONE,
      );
      expect(EvolutionMapper.mapEventType('qrcode.updated')).toBe(DataTypeWhatsapp.QR_RECEIVED);
      expect(EvolutionMapper.mapEventType('chats.update')).toBe(DataTypeWhatsapp.UNREAD_COUNT);
    });

    it('devolve null para eventos que o domínio não consome', () => {
      expect(EvolutionMapper.mapEventType('presence.update')).toBeNull();
      expect(EvolutionMapper.mapEventType('labels.edit')).toBeNull();
      expect(EvolutionMapper.mapEventType('evento.inexistente')).toBeNull();
    });
  });

  describe('mapConnectionState', () => {
    it('traduz o estado da conexão', () => {
      expect(EvolutionMapper.mapConnectionState({ state: 'open' })).toBe(DataTypeWhatsapp.READY);
      expect(EvolutionMapper.mapConnectionState({ state: 'close' })).toBe(
        DataTypeWhatsapp.DISCONNECTED,
      );
      expect(EvolutionMapper.mapConnectionState({ state: 'refused' })).toBe(
        DataTypeWhatsapp.DISCONNECTED,
      );
    });

    it('ignora o estado intermediário de conexão', () => {
      expect(EvolutionMapper.mapConnectionState({ state: 'connecting' })).toBeNull();
      expect(EvolutionMapper.mapConnectionState({})).toBeNull();
    });
  });

  describe('extractRemoteJid', () => {
    it('lê o JID nos dois shapes: aninhado no upsert, achatado no update', () => {
      expect(EvolutionMapper.extractRemoteJid('messages.upsert', upsertTexto)).toBe(
        '554199999999@s.whatsapp.net',
      );
      expect(
        EvolutionMapper.extractRemoteJid('messages.update', {
          keyId: 'ABC',
          remoteJid: '554188888888@s.whatsapp.net',
          fromMe: true,
        }),
      ).toBe('554188888888@s.whatsapp.net');
    });

    it('aceita chats.update tanto como array quanto como objeto', () => {
      expect(
        EvolutionMapper.extractRemoteJid('chats.update', [{ remoteJid: '5541@s.whatsapp.net' }]),
      ).toBe('5541@s.whatsapp.net');
      expect(EvolutionMapper.extractRemoteJid('chats.update', { id: '5542@s.whatsapp.net' })).toBe(
        '5542@s.whatsapp.net',
      );
    });

    it('devolve null quando não há JID', () => {
      expect(EvolutionMapper.extractRemoteJid('messages.upsert', null)).toBeNull();
      expect(EvolutionMapper.extractRemoteJid('presence.update', {})).toBeNull();
    });
  });

  describe('mapUpsert', () => {
    it('normaliza uma mensagem de texto recebida', () => {
      const result = EvolutionMapper.mapUpsert(upsertTexto);

      expect(result.id.id).toBe('3EB0C767D26A1D9B6E5F');
      expect(result.id.remote).toBe('554199999999@s.whatsapp.net');
      expect(result.type).toBe(MessageTypes.TEXT);
      expect(result.body).toBe('Bom dia, preciso de suporte');
      expect(result.fromMe).toBe(false);
      expect(result.from).toBe('554199999999@s.whatsapp.net');
      expect(result.hasMedia).toBe(false);
      expect(result.ack).toBe(MessageAck.ACK_DEVICE);
      expect(result.timestamp).toBe(1767390103);
      // `source` da Evolution substitui o `deviceType` do whatsapp-web.js
      expect(result.deviceType).toBe('android');
      // `pushName` substitui o `_data.notifyName`
      expect(result._data.notifyName).toBe('João da Silva');
    });

    it('inverte from/to em mensagem enviada por nós', () => {
      const result = EvolutionMapper.mapUpsert({
        ...upsertTexto,
        key: { ...upsertTexto.key, fromMe: true },
        status: 'SERVER_ACK',
      });

      expect(result.fromMe).toBe(true);
      expect(result.to).toBe('554199999999@s.whatsapp.net');
      expect(result.from).toBe('');
      expect(result.ack).toBe(MessageAck.ACK_SERVER);
    });

    it('usa a legenda como conteúdo e marca mídia em vídeo', () => {
      const result = EvolutionMapper.mapUpsert({
        ...upsertTexto,
        message: {
          videoMessage: {
            url: 'https://mmg.whatsapp.net/v/t62.7161-24/abc',
            mimetype: 'video/mp4',
            caption: 'Olha o defeito',
            fileLength: '20480000',
            seconds: 35,
          },
        },
        messageType: 'videoMessage',
      });

      expect(result.type).toBe(MessageTypes.VIDEO);
      expect(result.hasMedia).toBe(true);
      expect(result.body).toBe('Olha o defeito');
      expect(result.duration).toBe('35');
    });

    it('marca gif quando o vídeo tem gifPlayback', () => {
      const result = EvolutionMapper.mapUpsert({
        ...upsertTexto,
        message: { videoMessage: { mimetype: 'video/mp4', gifPlayback: true } },
        messageType: 'videoMessage',
      });

      expect(result.isGif).toBe(true);
    });

    it('distingue áudio de mensagem de voz pelo flag ptt', () => {
      const voz = EvolutionMapper.mapUpsert({
        ...upsertTexto,
        message: { audioMessage: { mimetype: 'audio/ogg', ptt: true, seconds: 12 } },
        messageType: 'audioMessage',
      });
      const audio = EvolutionMapper.mapUpsert({
        ...upsertTexto,
        message: { audioMessage: { mimetype: 'audio/mp4', ptt: false, seconds: 90 } },
        messageType: 'audioMessage',
      });

      expect(voz.type).toBe(MessageTypes.VOICE);
      expect(audio.type).toBe(MessageTypes.AUDIO);
    });

    it('resolve a mensagem citada pelo contextInfo', () => {
      const result = EvolutionMapper.mapUpsert({
        ...upsertTexto,
        message: { conversation: 'Sim, é esse mesmo' },
        contextInfo: {
          stanzaId: '3EB0ORIGINAL123',
          participant: '554199999999@s.whatsapp.net',
          quotedMessage: { conversation: 'É o equipamento da sala 2?' },
        },
      });

      expect(result.hasQuotedMsg).toBe(true);
      // No whatsapp-web.js isto vinha de `_data.quotedStanzaID`
      expect(result._data.quotedStanzaID).toBe('3EB0ORIGINAL123');
      expect(result._data.quotedMsg?.body).toBe('É o equipamento da sala 2?');
    });

    it('não marca citação quando não há contextInfo', () => {
      expect(EvolutionMapper.mapUpsert(upsertTexto).hasQuotedMsg).toBe(false);
    });

    it('cai em UNKNOWN em tipo desconhecido, sem lançar', () => {
      const result = EvolutionMapper.mapUpsert({
        ...upsertTexto,
        message: {},
        messageType: 'algoQueAindaNaoExiste',
      });

      expect(result.type).toBe(MessageTypes.UNKNOWN);
      expect(result.body).toBe('');
    });

    it('serializa vCards de contato único e múltiplo', () => {
      const unico = EvolutionMapper.mapUpsert({
        ...upsertTexto,
        message: { contactMessage: { displayName: 'Maria', vcard: 'BEGIN:VCARD...' } },
        messageType: 'contactMessage',
      });
      const multiplo = EvolutionMapper.mapUpsert({
        ...upsertTexto,
        message: {
          contactsArrayMessage: {
            contacts: [{ vcard: 'BEGIN:VCARD:1' }, { vcard: 'BEGIN:VCARD:2' }],
          },
        },
        messageType: 'contactsArrayMessage',
      });

      expect(unico.type).toBe(MessageTypes.CONTACT_CARD);
      expect(unico.vCards).toEqual(['BEGIN:VCARD...']);
      expect(multiplo.type).toBe(MessageTypes.CONTACT_CARD_MULTI);
      expect(multiplo.vCards).toHaveLength(2);
    });

    it('marca mensagem de status do broadcast', () => {
      const result = EvolutionMapper.mapUpsert({
        ...upsertTexto,
        key: { ...upsertTexto.key, remoteJid: 'status@broadcast' },
      });

      expect(result.isStatus).toBe(true);
    });

    it('assume DELIVERY_ACK em mensagem recebida sem status', () => {
      const result = EvolutionMapper.mapUpsert({ ...upsertTexto, status: undefined });
      expect(result.ack).toBe(MessageAck.ACK_DEVICE);
    });
  });

  describe('mapUpdate', () => {
    const update: EvolutionUpdateData = {
      keyId: '3EB0C767D26A1D9B6E5F',
      remoteJid: '554199999999@s.whatsapp.net',
      fromMe: true,
      status: 'READ',
    };

    it('extrai id e ack do shape achatado', () => {
      const result = EvolutionMapper.mapUpdate(update);

      expect(result.id.id).toBe('3EB0C767D26A1D9B6E5F');
      expect(result.ack).toBe(MessageAck.ACK_READ);
      expect(result.fromMe).toBe(true);
    });

    it('cobre a escala completa de status', () => {
      const esperado: [string, MessageAck][] = [
        ['ERROR', MessageAck.ACK_ERROR],
        ['PENDING', MessageAck.ACK_PENDING],
        ['SERVER_ACK', MessageAck.ACK_SERVER],
        ['DELIVERY_ACK', MessageAck.ACK_DEVICE],
        ['READ', MessageAck.ACK_READ],
        ['PLAYED', MessageAck.ACK_PLAYED],
      ];

      esperado.forEach(([status, ack]) => {
        expect(EvolutionMapper.mapUpdate({ ...update, status }).ack).toBe(ack);
      });
    });

    it('usa SERVER_ACK como padrão no update, diferente do upsert', () => {
      // A própria Evolution divergiu aqui: `?? 'SERVER_ACK'` no update.
      expect(EvolutionMapper.mapUpdate({ ...update, status: undefined }).ack).toBe(
        MessageAck.ACK_SERVER,
      );
    });
  });

  describe('mapDeleted', () => {
    it('preenche protocolMessageKey, de onde sai o id da mensagem revogada', () => {
      const deleteData: EvolutionDeleteData = {
        remoteJid: '554199999999@s.whatsapp.net',
        fromMe: false,
        id: '3EB0APAGADA999',
        status: 'DELETED',
      };

      const result = EvolutionMapper.mapDeleted(deleteData);

      expect(result.type).toBe(MessageTypes.REVOKED);
      expect(result.protocolMessageKey?.id).toBe('3EB0APAGADA999');
      expect(result.protocolMessageKey?.remote).toBe('554199999999@s.whatsapp.net');
    });
  });

  describe('mapReaction', () => {
    it('extrai a reação e a mensagem alvo', () => {
      const result = EvolutionMapper.mapReaction({
        ...upsertTexto,
        message: {
          reactionMessage: {
            key: {
              remoteJid: '554199999999@s.whatsapp.net',
              fromMe: true,
              id: '3EB0ALVO456',
            },
            text: '👍',
          },
        },
        messageType: 'reactionMessage',
      });

      expect(result?.reaction).toBe('👍');
      expect(result?.msgId.id).toBe('3EB0ALVO456');
    });

    it('representa remoção de reação com texto vazio', () => {
      const result = EvolutionMapper.mapReaction({
        ...upsertTexto,
        message: {
          reactionMessage: {
            key: { remoteJid: '5541@s.whatsapp.net', fromMe: false, id: 'ALVO' },
            text: '',
          },
        },
        messageType: 'reactionMessage',
      });

      expect(result?.reaction).toBe('');
    });

    it('devolve null quando não há reactionMessage', () => {
      expect(EvolutionMapper.mapReaction(upsertTexto)).toBeNull();
    });
  });

  describe('mapQrCode', () => {
    it('lê o código no wrapper duplo data.qrcode', () => {
      const data: EvolutionQrCodeData = {
        qrcode: {
          code: '2@abc123def456',
          base64: 'data:image/png;base64,iVBORw0KGgo=',
          pairingCode: null,
          count: 1,
        },
      };

      // A string crua é o que o front renderiza; o base64 é data URL.
      expect(EvolutionMapper.mapQrCode(data)).toBe('2@abc123def456');
    });

    it('devolve null quando o limite de leituras é atingido', () => {
      expect(
        EvolutionMapper.mapQrCode({ message: 'QR code limit reached', statusCode: 500 }),
      ).toBeNull();
    });
  });

  describe('extractPhoneFromWuid', () => {
    it('extrai apenas os dígitos do JID', () => {
      expect(EvolutionMapper.extractPhoneFromWuid('554199999999@s.whatsapp.net')).toBe(
        '554199999999',
      );
      expect(EvolutionMapper.extractPhoneFromWuid('554199999999:12@s.whatsapp.net')).toBe(
        '55419999999912',
      );
    });

    it('devolve null sem wuid', () => {
      expect(EvolutionMapper.extractPhoneFromWuid(undefined)).toBeNull();
      expect(EvolutionMapper.extractPhoneFromWuid('')).toBeNull();
    });
  });

  describe('toInternalPayload', () => {
    it('usa o campo instance como sessionId interno', () => {
      const result = EvolutionMapper.toInternalPayload(
        { event: 'messages.upsert', instance: 'CANAL-UUID-1', data: {} },
        DataTypeWhatsapp.MESSAGE_CREATE,
        { message: 'x' },
      );

      expect(result.sessionId).toBe('CANAL-UUID-1');
      expect(result.dataType).toBe(DataTypeWhatsapp.MESSAGE_CREATE);
    });
  });
});
