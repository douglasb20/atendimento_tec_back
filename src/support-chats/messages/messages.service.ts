import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { MessageData, MessageTypes, MessageWithLastMessage, Reaction } from '@/@types';
import { Channels } from '@/channels/entities/channels.entity';
import { StorageService } from '@/storage/storage.service';
import { WhatsappService } from '@/whatsapp/whatsapp.service';

import { getExtension, toMMSS } from '@/Utils';
import { EntityManager } from 'typeorm';
import { SupportChats } from '../entities/support-chats.entity';
import { SupportChatMessages } from './entities/support-chat-messages.entity';
import { MessagesRepository } from './messages.repository';

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly whatsappService: WhatsappService,
    private readonly storageService: StorageService,
  ) { }

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
    }

    return savedMessage;
  }

  async saveMessageAck(
    support_chat_id: number,
    messagePayload: MessageData,
    manager: EntityManager,
  ): Promise<MessageWithLastMessage> {
    const messageToUpdate = await this.messagesRepository.findOneBySupportChatIdAndMessageId(
      support_chat_id,
      messagePayload.id.id,
    );

    if (!messageToUpdate) {
      this.logger.warn(
        `Mensagem não encontrada para suporte_chat_id: ${support_chat_id} e message_id: ${messagePayload.id.id}`,
      );
      return null;
    }

    const updatedMessage = this.messagesRepository.create({
      ...messageToUpdate,
      ack: messagePayload.ack,
    });

    await manager.update(SupportChatMessages, updatedMessage.id, { ack: updatedMessage.ack });

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

    const updatedMessage = this.messagesRepository.create({
      ...messageToUpdate,
      is_deleted: true,
      type: MessageTypes.REVOKED,
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
      console.log('Processing image message...');

      const key = `chat/images/${randomUUID()}`;
      const { presignedUrl, mimeType, mediaSize, keyWithExtension } = await this.processUploadMedia(
        channel.session_id,
        messagePayload.id.remote,
        messagePayload.id.id,
        key,
        3,
      );

      console.log('Finished upload media message...');

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
    console.log('Processing sticker message...');

    const key = `chat/images/${randomUUID()}`;
    const { presignedUrl, mimeType, mediaSize, keyWithExtension } = await this.processUploadMedia(
      channel.session_id,
      messagePayload.id.remote,
      messagePayload.id.id,
      key,
      3,
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
    console.log('Processing voice message...');

    const key = `chat/voices/${randomUUID()}`;
    const { presignedUrl, mimeType, mediaSize, keyWithExtension } = await this.processUploadMedia(
      channel.session_id,
      messagePayload.id.remote,
      messagePayload.id.id,
      key,
      3,
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
    console.log('Processing video message...');

    const key = `chat/videos/${randomUUID()}`;
    const { presignedUrl, mimeType, mediaSize, keyWithExtension } = await this.processUploadMedia(
      channel.session_id,
      messagePayload.id.remote,
      messagePayload.id.id,
      key,
      3,
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
    console.log('Processing document message...');

    const key = `chat/documents/${randomUUID()}`;
    const { presignedUrl, mimeType, mediaSize, keyWithExtension } = await this.processUploadMedia(
      channel.session_id,
      messagePayload.id.remote,
      messagePayload.id.id,
      key,
      3,
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
    messagePayload.type = messagePayload.vCards.length > 1
      ? MessageTypes.CONTACT_CARD_MULTI
      : MessageTypes.CONTACT_CARD;
    const formatatedMessage = this.formatateMessageContent(messagePayload, channel, support_chat);

    const messageToSave = this.messagesRepository.create(formatatedMessage);

    return await this.saveMessage(messageToSave, manager, support_chat);
  }

  async saveMessage(
    message: SupportChatMessages,
    manager: EntityManager,
    support_chat: SupportChats = null,
  ): Promise<MessageWithLastMessage> {
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
      const presignedUrl = await this.storageService.generateViewUrl(savedMessage.media_url, 3);
      savedMessageWithLastMessage.media_url = presignedUrl;
    }

    return savedMessageWithLastMessage;
  }

  async getsignedUrlForMessageMedia(supportChatMessages: SupportChats): Promise<SupportChats> {
    const messagesWithSignedUrls = await Promise.all(
      supportChatMessages.supportChatMessages.map(async (message) => {
        if (message.has_media && message.media_url) {
          const presignedUrl = await this.storageService.generateViewUrl(message.media_url, 3);
          return {
            ...message,
            media_url: presignedUrl,
          };
        }
        return message;
      }),
    );
    return {
      ...supportChatMessages,
      supportChatMessages: messagesWithSignedUrls,
    };
  }

  async processUploadMedia(
    sessionId: string,
    chatId: string,
    messageId: string,
    key: string,
    duration: number,
  ): Promise<{
    presignedUrl: string;
    mimeType: string;
    mediaSize: number;
    keyWithExtension: string;
  }> {
    console.log('Processing upload media message...');
    const messageMedia = await this.whatsappService.downloadMedia(sessionId, messageId, chatId);

    const keyWithExtension = key + '.' + getExtension(messageMedia.mimetype);

    await this.storageService.uploadFileBase64(
      messageMedia.data,
      keyWithExtension,
      messageMedia.mimetype,
    );
    const presignedUrl = await this.storageService.generateViewUrl(keyWithExtension, duration);

    return {
      presignedUrl,
      mimeType: messageMedia.mimetype,
      mediaSize: messageMedia?.filesize || 0,
      keyWithExtension,
    };
  }

  formatateMessageContent(messagePayload: MessageData, channel: Channels, support_chat: SupportChats) {
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
      device_type: messagePayload.deviceType,
    };

    return formatatedMessage;
  }
}
