import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';

import { MessageAck, MessageData, MessageTypes, MessageWithLastMessage, Reaction } from '@/@types';
import { Channels } from '@/channels/entities/channels.entity';
import { StorageService } from '@/storage/storage.service';
import { WhatsappService } from '@/whatsapp/whatsapp.service';
import { RedisCacheRepository } from '@/redis-cache/redis-cache.repository';

import { getExtension, toMMSS } from '@/Utils';
import { SupportChats } from '../entities/support-chats.entity';
import { SupportChatMessages } from './entities/support-chat-messages.entity';
import { MessagesRepository } from './messages.repository';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);

  /**
   * Validade da reserva de envio, em segundos. Cobre a janela entre o envio e
   * o webhook - na prática, segundos. Passado esse tempo, a linha provisória
   * já está gravada e assume o papel.
   */
  private static readonly TTL_RESERVA_ENVIO = 120;
  constructor(
    private readonly redisCacheRepository: RedisCacheRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly whatsappService: WhatsappService,
    private readonly storageService: StorageService,
  ) {}

  async saveIncoming(
    channel: Channels,
    support_chat: SupportChats,
    messagePayload: MessageData,
    manager: EntityManager,
  ): Promise<MessageWithLastMessage> {
    let savedMessage: MessageWithLastMessage;
    switch (messagePayload.type) {
      case MessageTypes.TEXT:
        savedMessage = await this.processTextMessage(
          channel,
          support_chat,
          messagePayload,
          manager,
        );
        break;
      case MessageTypes.IMAGE:
        savedMessage = await this.processImageMessage(
          channel,
          support_chat,
          messagePayload,
          manager,
        );
        break;
      case MessageTypes.STICKER:
        savedMessage = await this.processStickerMessage(
          channel,
          support_chat,
          messagePayload,
          manager,
        );
        break;
      case MessageTypes.VOICE:
        savedMessage = await this.processVoiceMessage(
          channel,
          support_chat,
          messagePayload,
          manager,
        );
        break;
      case MessageTypes.VIDEO:
        savedMessage = await this.processVideoMessage(
          channel,
          support_chat,
          messagePayload,
          manager,
        );
        break;
      case MessageTypes.DOCUMENT:
        savedMessage = await this.processDocumentMessage(
          channel,
          support_chat,
          messagePayload,
          manager,
        );
        break;
      case MessageTypes.CONTACT_CARD:
      case MessageTypes.CONTACT_CARD_MULTI:
        savedMessage = await this.processContactCardMessage(
          channel,
          support_chat,
          messagePayload,
          manager,
        );
        break;
      default:
        // Tipos sem tratamento próprio (enquete, localização, template...) são
        // gravados como texto para não perder a mensagem nem interromper a fila.
        this.logger.warn(
          `Tipo de mensagem sem tratamento específico: ${messagePayload.type}. Persistindo como texto.`,
        );
        savedMessage = await this.processTextMessage(
          channel,
          support_chat,
          messagePayload,
          manager,
        );
        break;
    }

    delete savedMessage.raw_payload;
    return savedMessage;
  }

  /**
   * Atualiza o ack pela chave da mensagem.
   *
   * A busca é só pelo `message_id` (UNIQUE) de propósito: o ack da Evolution
   * chega com `remoteJid` em formato `@lid`, que não bate com o `remote_jid` do
   * contato, então localizar a conversa pelo JID falharia.
   *
   * O ack **só avança**. A Evolution entrega os eventos fora de ordem (um
   * SERVER_ACK pode chegar depois do READ do mesmo envio), e gravar o último
   * que chega faria a mensagem regredir de "lido" para "enviado" na tela.
   */
  async saveMessageAck(
    messagePayload: MessageData,
    manager: EntityManager,
  ): Promise<MessageWithLastMessage> {
    const messageToUpdate = await this.messagesRepository.findOneByMessageId(messagePayload.id.id);

    if (!messageToUpdate) {
      this.logger.warn(`Mensagem não encontrada para message_id: ${messagePayload.id.id}`);
      return null;
    }

    const ackAtual = messageToUpdate.ack ?? 0;
    const ackNovo = messagePayload.ack;

    // ACK_ERROR (-1) é exceção: sinaliza falha no envio e vale mesmo depois de
    // um status positivo.
    const regride = ackNovo <= ackAtual && ackNovo !== MessageAck.ACK_ERROR;

    if (regride) {
      this.logger.debug(
        `Ack ignorado para ${messagePayload.id.id}: ${ackNovo} não supera o atual ${ackAtual}.`,
      );
      return null;
    }

    const updatedMessage = this.messagesRepository.create({
      ...messageToUpdate,
      ack: ackNovo,
    });

    await manager.update(SupportChatMessages, updatedMessage.id, { ack: ackNovo });

    return updatedMessage;
  }

  async saveMessageReaction(
    support_chat_id: number,
    reactionPayload: Reaction,
    manager: EntityManager,
  ): Promise<MessageWithLastMessage> {
    const messageToUpdate = await this.messagesRepository.findOneBySupportChatIdAndMessageId(
      support_chat_id,
      reactionPayload.msgId.id,
    );

    const updatedMessage = this.messagesRepository.create({
      ...messageToUpdate,
      reaction: reactionPayload.reaction || '',
      has_reaction: !!reactionPayload.reaction,
    });

    return this.saveMessage(updatedMessage, manager);
  }

  async saveMessageEdited(
    support_chat: SupportChats,
    messagePayload: MessageData,
    manager: EntityManager,
  ) {
    const messageToUpdate = await this.messagesRepository.findOneBySupportChatIdAndMessageId(
      support_chat.id,
      messagePayload.id.id,
    );

    const updatedMessage = this.messagesRepository.create({
      ...messageToUpdate,
      content: messagePayload.body || '',
      is_edited: true,
    });

    return this.saveMessage(
      updatedMessage,
      manager,
      support_chat.last_message_id === updatedMessage.message_id ? support_chat : null,
    );
  }

  async saveMessageRevokeEveryone(
    support_chat: SupportChats,
    messagePayload: MessageData,
    manager: EntityManager,
  ): Promise<MessageWithLastMessage> {
    const messageToUpdate = await this.messagesRepository.findOneBySupportChatIdAndMessageId(
      support_chat.id,
      messagePayload.protocolMessageKey.id,
    );

    // O conteúdo é descartado junto: uma mensagem revogada não deve deixar
    // rastro do texto original, nem no histórico nem na prévia da conversa.
    const updatedMessage = this.messagesRepository.create({
      ...messageToUpdate,
      is_deleted: true,
      type: MessageTypes.REVOKED,
      content: '',
      media_url: null,
      has_media: false,
    });

    return this.saveMessage(
      updatedMessage,
      manager,
      support_chat.last_message_id === updatedMessage.message_id ? support_chat : null,
    );
  }

  async processTextMessage(
    channel: Channels,
    support_chat: SupportChats,
    messagePayload: MessageData,
    manager: EntityManager,
  ): Promise<MessageWithLastMessage> {
    const existingCachedMessage = await this.redisCacheRepository.get(
      `message:messageId:${messagePayload.id.id}`,
    );
    if (existingCachedMessage) {
      this.logger.log('Message already processed, skipping save.');
    }
    const formatatedMessage = this.formatateMessageContent(messagePayload, channel, support_chat);
    const messageToSave = this.messagesRepository.create(formatatedMessage);

    return await this.saveMessage(messageToSave, manager, support_chat);
  }

  async processImageMessage(
    channel: Channels,
    support_chat: SupportChats,
    messagePayload: MessageData,
    manager: EntityManager,
  ): Promise<MessageWithLastMessage> {
    try {
      this.logger.log('Processing image message...');

      const key = `chat/images/${randomUUID()}`;
      const { presignedUrl, mimeType, mediaSize, keyWithExtension } = await this.processUploadMedia(
        channel.session_id,
        messagePayload.id.remote,
        messagePayload.id.id,
        key,
      );

      this.logger.log('Finished upload media message...');

      const formatatedMessage = this.formatateMessageContent(messagePayload, channel, support_chat);

      const messageToSave = this.messagesRepository.create({
        ...formatatedMessage,
        has_media: messagePayload.hasMedia,
        media_url: keyWithExtension,
        media_type: mimeType,
        media_size: mediaSize,
      });

      const savedMessage = await this.saveMessage(messageToSave, manager, support_chat);
      savedMessage.media_url = presignedUrl;

      return savedMessage;
    } catch (err) {
      this.logger.error('Erro ao processar mensagem de imagem:', err);
      throw err;
    }
  }

  async processStickerMessage(
    channel: Channels,
    support_chat: SupportChats,
    messagePayload: MessageData,
    manager: EntityManager,
  ): Promise<MessageWithLastMessage> {
    this.logger.log('Processing sticker message...');

    const key = `chat/images/${randomUUID()}`;
    const { presignedUrl, mimeType, mediaSize, keyWithExtension } = await this.processUploadMedia(
      channel.session_id,
      messagePayload.id.remote,
      messagePayload.id.id,
      key,
    );

    const formatatedMessage = this.formatateMessageContent(messagePayload, channel, support_chat);

    const messageToSave = this.messagesRepository.create({
      ...formatatedMessage,
      has_media: messagePayload.hasMedia,
      media_url: keyWithExtension,
      media_type: mimeType,
      media_size: mediaSize,
    });

    const savedMessage = await this.saveMessage(messageToSave, manager, support_chat);
    savedMessage.media_url = presignedUrl;
    return savedMessage;
  }

  async processVoiceMessage(
    channel: Channels,
    support_chat: SupportChats,
    messagePayload: MessageData,
    manager: EntityManager,
  ): Promise<MessageWithLastMessage> {
    this.logger.log('Processing voice message...');

    const key = `chat/voices/${randomUUID()}`;
    const { presignedUrl, mimeType, mediaSize, keyWithExtension } = await this.processUploadMedia(
      channel.session_id,
      messagePayload.id.remote,
      messagePayload.id.id,
      key,
    );

    messagePayload.body = toMMSS(messagePayload.duration || 0);
    const formatatedMessage = this.formatateMessageContent(messagePayload, channel, support_chat);

    const messageToSave = this.messagesRepository.create({
      ...formatatedMessage,
      has_media: messagePayload.hasMedia,
      media_url: keyWithExtension,
      media_type: mimeType.split(';')[0],
      media_size: mediaSize,
    });

    const savedMessage = await this.saveMessage(messageToSave, manager, support_chat);
    savedMessage.media_url = presignedUrl;
    return savedMessage;
  }

  async processVideoMessage(
    channel: Channels,
    support_chat: SupportChats,
    messagePayload: MessageData,
    manager: EntityManager,
  ): Promise<MessageWithLastMessage> {
    this.logger.log('Processing video message...');

    const key = `chat/videos/${randomUUID()}`;
    const { presignedUrl, mimeType, mediaSize, keyWithExtension } = await this.processUploadMedia(
      channel.session_id,
      messagePayload.id.remote,
      messagePayload.id.id,
      key,
    );

    const formatatedMessage = this.formatateMessageContent(messagePayload, channel, support_chat);

    const messageToSave = this.messagesRepository.create({
      ...formatatedMessage,
      has_media: messagePayload.hasMedia,
      media_url: keyWithExtension,
      media_type: mimeType,
      media_size: mediaSize,
      is_gif: messagePayload.isGif,
    });

    const savedMessage = await this.saveMessage(messageToSave, manager, support_chat);
    savedMessage.media_url = presignedUrl;
    return savedMessage;
  }

  async processDocumentMessage(
    channel: Channels,
    support_chat: SupportChats,
    messagePayload: MessageData,
    manager: EntityManager,
  ): Promise<MessageWithLastMessage> {
    this.logger.log('Processing document message...');

    const key = `chat/documents/${randomUUID()}`;
    const { presignedUrl, mimeType, mediaSize, keyWithExtension } = await this.processUploadMedia(
      channel.session_id,
      messagePayload.id.remote,
      messagePayload.id.id,
      key,
    );

    const formatatedMessage = this.formatateMessageContent(messagePayload, channel, support_chat);

    const messageToSave = this.messagesRepository.create({
      ...formatatedMessage,
      has_media: messagePayload.hasMedia,
      media_url: keyWithExtension,
      media_type: mimeType,
      media_size: mediaSize,
    });

    const savedMessage = await this.saveMessage(messageToSave, manager, support_chat);
    savedMessage.media_url = presignedUrl;
    return savedMessage;
  }

  async processContactCardMessage(
    channel: Channels,
    support_chat: SupportChats,
    messagePayload: MessageData,
    manager: EntityManager,
  ): Promise<MessageWithLastMessage> {
    messagePayload.body = JSON.stringify(messagePayload.vCards);
    messagePayload.type =
      messagePayload.vCards.length > 1
        ? MessageTypes.CONTACT_CARD_MULTI
        : MessageTypes.CONTACT_CARD;
    const formatatedMessage = this.formatateMessageContent(messagePayload, channel, support_chat);

    const messageToSave = this.messagesRepository.create(formatatedMessage);

    return await this.saveMessage(messageToSave, manager, support_chat);
  }

  /** Busca pela chave do provider, que tem constraint UNIQUE. */
  async findByMessageId(messageId: string): Promise<SupportChatMessages | null> {
    return this.messagesRepository.findOneByMessageId(messageId);
  }

  /**
   * Grava a mensagem no instante do envio, antes da confirmação do provider.
   *
   * Duas razões: a mensagem existe no histórico mesmo que o webhook se perca, e
   * o `datetime` marca a posição definitiva na conversa - um vídeo grande, cujo
   * webhook demora, não pula para baixo dos textos enviados depois dele.
   *
   * Os campos que só o WhatsApp conhece ficam vazios; o webhook os completa.
   */
  async saveOutgoing(
    dados: {
      messageId: string;
      channel: Channels;
      supportChat: SupportChats;
      to: string;
      content: string;
      type: MessageTypes;
      mediaUrl?: string;
      mediaType?: string;
      /** Nome original do arquivo - é o que identifica o documento na conversa. */
      fileName?: string;
      quotedMsgId?: string;
      sentAt?: Date;
    },
    manager: EntityManager,
  ): Promise<MessageWithLastMessage> {
    const message = this.messagesRepository.create({
      message_id: dados.messageId,
      support_chat_id: dados.supportChat.id,
      channel_id: dados.channel.id,
      datetime: dados.sentAt ?? new Date(),
      ack: MessageAck.ACK_PENDING,
      type: dados.type,
      from_me: true,
      content: dados.content ?? '',
      has_media: Boolean(dados.mediaUrl),
      media_url: dados.mediaUrl ?? null,
      media_type: dados.mediaType ?? null,
      file_name: dados.fileName ?? null,
      has_quoted: Boolean(dados.quotedMsgId),
      quoted_msg_id: dados.quotedMsgId ?? null,
      from: dados.channel.phone_number ?? '',
      to: dados.to,
      device_type: null,
      is_deleted: false,
      is_edited: false,
      raw_payload: '{}',
    } as Partial<SupportChatMessages>);

    return this.saveMessage(message, manager, dados.supportChat);
  }

  async saveMessage(
    message: SupportChatMessages,
    manager: EntityManager,
    support_chat: SupportChats = null,
  ): Promise<MessageWithLastMessage> {
    // O envio pelo portal grava uma linha provisória antes do provider
    // confirmar, para a mensagem existir no histórico mesmo que o webhook se
    // perca. Quando ele chega, completa aquela linha em vez de criar outra -
    // sem isto o `manager.save` inseriria uma duplicata, já que a entidade
    // montada aqui não carrega o `id`.
    const existente = message.message_id
      ? await this.messagesRepository.findOneByMessageId(message.message_id)
      : null;

    if (existente) {
      // O `datetime` da linha provisória é o instante do envio, que define a
      // posição na conversa; o do webhook chega depois e reordenaria a lista.
      message = { ...existente, ...message, id: existente.id, datetime: existente.datetime };

      // O webhook não traz o nome nem o tamanho do arquivo que nós enviamos -
      // sem isto, o espalhamento acima sobrescreveria com null o que a linha
      // provisória guardou, e o documento voltaria a aparecer sem nome.
      message.file_name ??= existente.file_name;
      message.media_size ||= existente.media_size;
    }

    const savedMessage = await manager.save(SupportChatMessages, message);
    const savedMessageWithLastMessage: MessageWithLastMessage = {
      ...savedMessage,
      lastMessage: null,
    };

    if (support_chat) {
      savedMessageWithLastMessage.lastMessage = {
        id: savedMessage.message_id,
        type: savedMessage.type,
        content: savedMessage.content,
      };
    }

    if (savedMessage.has_media && savedMessage.media_url) {
      savedMessageWithLastMessage.media_url = this.storageService.getPublicUrl(
        savedMessage.media_url,
      );
    }

    return savedMessageWithLastMessage;
  }

  /**
   * Resolve as URLs de mídia das mensagens do chat.
   *
   * Com o bucket público a URL é permanente: não há assinatura por mensagem nem
   * cache a manter (antes era uma URL assinada por item, cacheada no Redis com
   * validade menor que a da assinatura).
   */
  /**
   * Converte a key de mídia na URL pública de uma mensagem só.
   *
   * As colunas guardam a **key**, não a URL - a leitura HTTP já traduz isso no
   * `getUrlForMessageMedia`, mas o que sai pelo WebSocket vinha cru, e o front
   * recebia `chat/media/xxx.jpeg` como se fosse endereço. A imagem só aparecia
   * ao recarregar a página, quando o caminho HTTP refazia a URL.
   */
  comUrlPublica<T extends { has_media?: boolean; media_url?: string }>(message: T): T {
    if (!message?.has_media || !message.media_url) return message;

    return { ...message, media_url: this.storageService.getPublicUrl(message.media_url) };
  }

  getUrlForMessageMedia(supportChatMessages: SupportChats): SupportChats {
    const messagesWithUrls = supportChatMessages.supportChatMessages.map((message) => {
      if (message.has_media && message.media_url) {
        return {
          ...message,
          media_url: this.storageService.getPublicUrl(message.media_url),
        };
      }
      return message;
    });

    return {
      ...supportChatMessages,
      supportChatMessages: messagesWithUrls,
    };
  }

  /**
   * Reserva de envio: registra que a mídia de `messageId` já está no storage,
   * para o webhook não baixá-la de volta.
   *
   * Gravada antes da chamada ao provider justamente porque o webhook chega
   * junto com a resposta dele. O TTL curto basta: ou o webhook chega em
   * segundos, ou a linha no banco já assumiu o papel.
   */
  async reservaEnvioComMidia(
    messageId: string,
    dados: { mediaKey: string; mimetype?: string; mediaSize?: number },
  ): Promise<void> {
    await this.redisCacheRepository.set(
      `envioComMidia:${messageId}`,
      JSON.stringify(dados),
      MessagesService.TTL_RESERVA_ENVIO,
    );
  }

  /** Lê a reserva; um Redis indisponível apenas devolve ao caminho do banco. */
  private async consultaReservaEnvio(
    messageId: string,
  ): Promise<{ mediaKey: string; mimetype?: string; mediaSize?: number } | null> {
    try {
      const bruto = await this.redisCacheRepository.get(`envioComMidia:${messageId}`);
      return bruto ? JSON.parse(bruto as string) : null;
    } catch {
      return null;
    }
  }

  /** A linha provisória, quando o `registraEnvio` chegou antes do webhook. */
  private async buscaMediaJaNoStorage(
    messageId: string,
  ): Promise<{ mediaKey: string; mimetype?: string; mediaSize?: number } | null> {
    const existente = await this.messagesRepository.findOneByMessageId(messageId);
    if (!existente?.media_url) return null;

    return {
      mediaKey: existente.media_url,
      mimetype: existente.media_type ?? '',
      mediaSize: Number(existente.media_size) || 0,
    };
  }

  async processUploadMedia(
    sessionId: string,
    chatId: string,
    messageId: string,
    key: string,
  ): Promise<{
    presignedUrl: string;
    mimeType: string;
    mediaSize: number;
    keyWithExtension: string;
  }> {
    // Mídia que nós mesmos enviamos já está no storage: baixá-la de volta do
    // provider seria trabalho perdido - e falha, porque a mensagem enviada não
    // tem o conteúdo lá para servir.
    //
    // A reserva no Redis é consultada antes da linha do banco de propósito: a
    // Evolution dispara o webhook no mesmo instante em que responde ao envio,
    // e chega a vencer a gravação da linha provisória. Com um arquivo pequeno
    // a corrida é perdida quase sempre. A reserva é gravada **antes** da
    // chamada ao provider, então já está lá quando o webhook consulta.
    const reservado = await this.consultaReservaEnvio(messageId);
    const jaNoStorage = reservado ?? (await this.buscaMediaJaNoStorage(messageId));

    if (jaNoStorage) {
      this.logger.log('Mídia já no storage (envio nosso); download dispensado.');
      return {
        presignedUrl: this.storageService.getPublicUrl(jaNoStorage.mediaKey),
        mimeType: jaNoStorage.mimetype ?? '',
        mediaSize: jaNoStorage.mediaSize ?? 0,
        keyWithExtension: jaNoStorage.mediaKey,
      };
    }

    this.logger.log('Processing upload media message...');
    const messageMedia = await this.whatsappService.downloadMedia(sessionId, messageId, chatId);

    const keyWithExtension = key + '.' + getExtension(messageMedia.mimetype);

    await this.storageService.uploadFileBase64(
      messageMedia.data,
      keyWithExtension,
      messageMedia.mimetype,
    );

    return {
      presignedUrl: this.storageService.getPublicUrl(keyWithExtension),
      mimeType: messageMedia.mimetype,
      mediaSize: messageMedia?.filesize || 0,
      keyWithExtension,
    };
  }

  formatateMessageContent(
    messagePayload: MessageData,
    channel: Channels,
    support_chat: SupportChats,
  ) {
    const formatatedMessage = {
      support_chat_id: support_chat.id,
      channel_id: channel.id,
      message_id: messagePayload.id.id,
      datetime: new Date(messagePayload.timestamp * 1000),
      ack: messagePayload.ack,
      type: messagePayload.type,
      from_me: messagePayload.fromMe,
      content: messagePayload.body,
      from: messagePayload.from,
      to: messagePayload.to,
      device_type: messagePayload.deviceType ?? null,
      has_quoted: messagePayload.hasQuotedMsg,
      quoted_msg_id: messagePayload.hasQuotedMsg
        ? (messagePayload._data?.quotedStanzaID ?? null)
        : null,
      // O provider pode informar a mensagem citada sem enviar o conteúdo dela.
      quoted_msg: messagePayload.hasQuotedMsg
        ? (messagePayload._data?.quotedMsg?.body ?? null)
        : null,
      raw_payload: JSON.stringify(messagePayload),
    };

    return formatatedMessage;
  }
}
