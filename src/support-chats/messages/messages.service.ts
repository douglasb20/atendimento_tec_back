import { Injectable } from '@nestjs/common';
import { MessageData, MessageTypes } from '@types';
import { SupportChatMessages } from './entities/support-chat-messages.entity';
import { MessagesRepository } from './messages.repository';

@Injectable()
export class MessagesService {
  constructor(private readonly messagesRepository: MessagesRepository) {}
  async saveIncoming(support_chat_id: number, channel_id: number, messagePayload: MessageData) {
    let savedMessage: SupportChatMessages;
    switch (messagePayload.type) {
      case MessageTypes.TEXT:
        savedMessage = await this.processTextMessage(support_chat_id, channel_id, messagePayload);
        break;
      case MessageTypes.IMAGE:
        await this.processImageMessage(support_chat_id, channel_id, messagePayload);
        break;
      // Handle other message types...
      default:
        throw new Error(`Unsupported message type: ${messagePayload.type}`);
    }

    return savedMessage;
  }

  async processTextMessage(
    support_chat_id: number,
    channel_id: number,
    messagePayload: MessageData,
  ) {
    const message = this.messagesRepository.create({
      support_chat_id,
      channel_id,
      message_id: messagePayload.id.id,
      datetime: new Date(messagePayload.timestamp * 1000),
      ack: messagePayload.ack,
      type: MessageTypes.TEXT,
      from_me: messagePayload.fromMe,
      content: messagePayload.body,
      from: messagePayload.from,
      to: messagePayload.to,
    });

    const savedMessage = await this.messagesRepository.save(message);

    return savedMessage;
  }

  async processImageMessage(support_chat_id: number, channel_id: number, message: MessageData) {
    console.log(support_chat_id, channel_id, message);
    // Logic to process and save image message
  }
}
