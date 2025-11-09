import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { MessageData, MessageTypes, Reaction } from '@/@types';
import { WhatsappService } from '@/whatsapp/whatsapp.service';
import { Channels } from '@/channels/entities/channels.entity';
import { StorageService } from '@/storage/storage.service';

import { SupportChatMessages } from './entities/support-chat-messages.entity';
import { MessagesRepository } from './messages.repository';
import { getExtension, toMMSS } from '@/Utils';

@Injectable()
export class MessagesService {
  constructor(
    private readonly messagesRepository: MessagesRepository,
    private readonly whatsappService: WhatsappService,
    private readonly storageService: StorageService,
  ) { }

  async saveIncoming(channel: Channels, support_chat_id: number, messagePayload: MessageData) {
    let savedMessage: SupportChatMessages;
    switch (messagePayload.type) {
      case MessageTypes.TEXT:
        savedMessage = await this.processTextMessage(channel, support_chat_id, messagePayload);
        break;
      case MessageTypes.IMAGE:
        savedMessage = await this.processImageMessage(channel, support_chat_id, messagePayload);
        break;
      case MessageTypes.STICKER:
        savedMessage = await this.processStickerMessage(channel, support_chat_id, messagePayload);
        break;
      case MessageTypes.VOICE:
        savedMessage = await this.processVoiceMessage(channel, support_chat_id, messagePayload);
        break;
      case MessageTypes.VIDEO:
        savedMessage = await this.processVideoMessage(channel, support_chat_id, messagePayload);
        break;
      case MessageTypes.DOCUMENT:
        savedMessage = await this.processDocumentMessage(channel, support_chat_id, messagePayload);
        break;
      case MessageTypes.CONTACT_CARD:
      case MessageTypes.CONTACT_CARD_MULTI:
        savedMessage = await this.processContactCardMessage(channel, support_chat_id, messagePayload);
        break;
    }

    return savedMessage;
  }

  async saveMessageAck(support_chat_id: number, messagePayload: MessageData) {
    const messageToUpdate = await this.messagesRepository.findOneBySupportChatIdAndMessageId(
      support_chat_id,
      messagePayload.id.id,
    );

    const updatedMessage = this.messagesRepository.create({
      ...messageToUpdate,
      ack: messagePayload.ack,
    });


    return this.saveMessage(updatedMessage);
  }

  async saveMessageReaction(support_chat_id: number, reactionPayload: Reaction) {
    const messageToUpdate = await this.messagesRepository.findOneBySupportChatIdAndMessageId(
      support_chat_id,
      reactionPayload.msgId.id,
    );

    const updatedMessage = this.messagesRepository.create({
      ...messageToUpdate,
      reaction: reactionPayload.reaction || '',
      has_reaction: !!reactionPayload.reaction,
    });


    return this.saveMessage(updatedMessage);
  }

  async saveMessageEdited(support_chat_id: number, messagePayload: MessageData) {
    const messageToUpdate = await this.messagesRepository.findOneBySupportChatIdAndMessageId(
      support_chat_id,
      messagePayload.id.id,
    );

    const updatedMessage = this.messagesRepository.create({
      ...messageToUpdate,
      content: messagePayload.body || '',
      is_edited: true,
    });

    return this.saveMessage(updatedMessage);
  }

  async saveMessageRevokeEveryone(support_chat_id: number, messagePayload: MessageData) {
    const messageToUpdate = await this.messagesRepository.findOneBySupportChatIdAndMessageId(
      support_chat_id,
      messagePayload.protocolMessageKey.id,
    );

    const updatedMessage = this.messagesRepository.create({
      ...messageToUpdate,
      is_deleted: true,
    });

    return this.saveMessage(updatedMessage);
  }

  async processTextMessage(
    channel: Channels,
    support_chat_id: number,
    messagePayload: MessageData,
  ) {
    const messageToSave = this.messagesRepository.create({
      support_chat_id,
      channel_id: channel.id,
      message_id: messagePayload.id.id,
      datetime: new Date(messagePayload.timestamp * 1000),
      ack: messagePayload.ack,
      type: MessageTypes.TEXT,
      from_me: messagePayload.fromMe,
      content: messagePayload.body,
      from: messagePayload.from,
      to: messagePayload.to,
    });


    return await this.saveMessage(messageToSave);
  }

  async processContactCardMessage(
    channel: Channels,
    support_chat_id: number,
    messagePayload: MessageData,
  ) {
    const messageToSave = this.messagesRepository.create({
      support_chat_id,
      channel_id: channel.id,
      message_id: messagePayload.id.id,
      datetime: new Date(messagePayload.timestamp * 1000),
      ack: messagePayload.ack,
      type: messagePayload.vCards.length > 1 ? MessageTypes.CONTACT_CARD_MULTI : MessageTypes.CONTACT_CARD,
      from_me: messagePayload.fromMe,
      content: JSON.stringify(messagePayload.vCards),
      from: messagePayload.from,
      to: messagePayload.to,
    });


    return await this.saveMessage(messageToSave);
  }

  async processImageMessage(channel: Channels, support_chat_id: number, messagePayload: MessageData): Promise<SupportChatMessages> {
    console.log("Processing image message...");

    const key = `chat/images/${randomUUID()}`;
    const { presignedUrl, mimeType, mediaSize } = await this.processUploadMedia(channel.session_id, messagePayload.id.remote, messagePayload.id.id, key, 3);

    const messageToSave = this.messagesRepository.create({
      support_chat_id,
      channel_id: channel.id,
      message_id: messagePayload.id.id,
      datetime: new Date(messagePayload.timestamp * 1000),
      ack: messagePayload.ack,
      type: MessageTypes.IMAGE,
      from_me: messagePayload.fromMe,
      content: messagePayload.body || 'Imagem',
      from: messagePayload.from,
      to: messagePayload.to,
      has_media: messagePayload.hasMedia,
      media_url: key,
      media_type: mimeType,
      media_size: mediaSize,
    });
    const savedMessage = await this.saveMessage(messageToSave);
    savedMessage.media_url = presignedUrl;
    return savedMessage;
  }

  async processStickerMessage(channel: Channels, support_chat_id: number, messagePayload: MessageData): Promise<SupportChatMessages> {
    console.log("Processing image message...");

    const key = `chat/images/${randomUUID()}`;
    const { presignedUrl, mimeType, mediaSize } = await this.processUploadMedia(channel.session_id, messagePayload.id.remote, messagePayload.id.id, key, 3);

    const messageToSave = this.messagesRepository.create({
      support_chat_id,
      channel_id: channel.id,
      message_id: messagePayload.id.id,
      datetime: new Date(messagePayload.timestamp * 1000),
      ack: messagePayload.ack,
      type: MessageTypes.STICKER,
      from_me: messagePayload.fromMe,
      content: messagePayload.body || 'Figurinha',
      from: messagePayload.from,
      to: messagePayload.to,
      has_media: messagePayload.hasMedia,
      media_url: key,
      media_type: mimeType,
      media_size: mediaSize,
    });
    const savedMessage = await this.saveMessage(messageToSave);
    savedMessage.media_url = presignedUrl;
    return savedMessage;
  }

  async processVoiceMessage(channel: Channels, support_chat_id: number, messagePayload: MessageData) {
    console.log("Processing voice message...");

    const key = `chat/voices/${randomUUID()}`;
    const { presignedUrl, mimeType, mediaSize } = await this.processUploadMedia(channel.session_id, messagePayload.id.remote, messagePayload.id.id, key, 3);

    const messageToSave = this.messagesRepository.create({
      support_chat_id,
      channel_id: channel.id,
      message_id: messagePayload.id.id,
      datetime: new Date(messagePayload.timestamp * 1000),
      ack: messagePayload.ack,
      type: MessageTypes.VOICE,
      from_me: messagePayload.fromMe,
      content: toMMSS(messagePayload.duration || 0),
      from: messagePayload.from,
      to: messagePayload.to,
      has_media: messagePayload.hasMedia,
      media_url: key,
      media_type: mimeType.split(";")[0],
      media_size: mediaSize,
    });

    const savedMessage = await this.saveMessage(messageToSave);
    savedMessage.media_url = presignedUrl;
    return savedMessage;
  }

  async processVideoMessage(channel: Channels, support_chat_id: number, messagePayload: MessageData): Promise<SupportChatMessages> {
    console.log("Processing video message...");

    const key = `chat/videos/${randomUUID()}`;
    const { presignedUrl, mimeType, mediaSize } = await this.processUploadMedia(channel.session_id, messagePayload.id.remote, messagePayload.id.id, key, 3);

    const messageToSave = this.messagesRepository.create({
      support_chat_id,
      channel_id: channel.id,
      message_id: messagePayload.id.id,
      datetime: new Date(messagePayload.timestamp * 1000),
      ack: messagePayload.ack,
      type: MessageTypes.VIDEO,
      from_me: messagePayload.fromMe,
      content: messagePayload.body || (messagePayload.isGif ? 'GIF' : 'Vídeo'),
      from: messagePayload.from,
      to: messagePayload.to,
      has_media: messagePayload.hasMedia,
      media_url: key,
      media_type: mimeType,
      media_size: mediaSize,
      is_gif: messagePayload.isGif,
    });
    const savedMessage = await this.saveMessage(messageToSave);
    savedMessage.media_url = presignedUrl;
    return savedMessage;
  }

  async processDocumentMessage(channel: Channels, support_chat_id: number, messagePayload: MessageData): Promise<SupportChatMessages> {
    console.log("Processing document message...");

    const key = `chat/documents/${randomUUID()}`;
    const { presignedUrl, mimeType, mediaSize } = await this.processUploadMedia(channel.session_id, messagePayload.id.remote, messagePayload.id.id, key, 3);

    const messageToSave = this.messagesRepository.create({
      support_chat_id,
      channel_id: channel.id,
      message_id: messagePayload.id.id,
      datetime: new Date(messagePayload.timestamp * 1000),
      ack: messagePayload.ack,
      type: MessageTypes.DOCUMENT,
      from_me: messagePayload.fromMe,
      content: messagePayload.body || 'Documento',
      from: messagePayload.from,
      to: messagePayload.to,
      has_media: messagePayload.hasMedia,
      media_url: key,
      media_type: mimeType,
      media_size: mediaSize,
    });
    const savedMessage = await this.saveMessage(messageToSave);
    savedMessage.media_url = presignedUrl;
    return savedMessage;
  }

  // @ts-ignore
  processReactionMessage(support_chat_id: number, channel_id: number, message: MessageData) {

  }

  async saveMessage(
    message: SupportChatMessages
  ): Promise<SupportChatMessages> {
    const savedMessage = await this.messagesRepository.save(message);
    return savedMessage;
  }

  async processUploadMedia(sessionId: string, chatId: string, messageId: string, key: string, duration: number): Promise<{ presignedUrl: string; mimeType: string; mediaSize: number }> {
    console.log("Processing upload media message...");
    const messageMedia = await this.whatsappService.downloadMedia(sessionId, messageId, chatId);

    const keyWithExtension = key + '.' + getExtension(messageMedia.mimetype);

    await this.storageService.uploadFileBase64(messageMedia.data, keyWithExtension, messageMedia.mimetype);
    const presignedUrl = await this.storageService.generateViewUrl(keyWithExtension, duration);

    return { presignedUrl, mimeType: messageMedia.mimetype, mediaSize: messageMedia?.filesize || 0 };

  }
}
