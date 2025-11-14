import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { ChannelsService } from '@/channels/channels.service';
import { ContactsService } from '@/contacts/contacts.service';
import { WhatsappService } from '@/whatsapp/whatsapp.service';
import {
  ChatPayload,
  MessageEditPayload,
  MessagePayload,
  ReactionPayload,
  WhatsappWebhookPayload,
} from '@types';

import { Contacts } from '@/contacts/entities/contacts.entity';
import { runInTransaction } from '@/Utils';
import { SupportChats } from './entities/support-chats.entity';
import { MessagesService } from './messages/messages.service';
import { SupportChatsRepository } from './support-chats.repository';

@Injectable()
export class SupportChatsService {
  private readonly logger = new Logger(SupportChatsService.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly messagesService: MessagesService,
    private readonly channelsService: ChannelsService,
    private readonly contactsService: ContactsService,
    private readonly supportChatsRepository: SupportChatsRepository,
    private readonly dataSource: DataSource,
  ) {}

  async sendMessage(to: string, message: string) {
    this.logger.log(`Enviando mensagem de para ${to} com mensagem: ${message}`);
    this.whatsappService.sendMessage('f8377d8d-a589-4242-9ba6-9486a04ef80c', to, message);
  }

  async listAllSupportChats() {
    return this.supportChatsRepository.findAllSupportChats();
  }

  async findSupportChatsById(id: number) {
    return this.supportChatsRepository.findSupportChatsById(id);
  }

  // ====== Event Listeners Handles ======
  async onMessageCreate(payload: WhatsappWebhookPayload<MessagePayload>) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const { sessionId, data } = payload;
        const channel = await this.channelsService.getChannelBySessionId(sessionId);
        const phoneContact = data.message.id.remote;

        const contact = await this.contactsService.findOrCreateByRemoteJid(
          {
            sessionId,
            remote_jid: phoneContact,
            name: data.message._data?.notifyName,
          },
          manager,
        );

        const supportChat = await this.findOrOpen(contact.id, channel.id, manager);

        const savedMessage = await this.messagesService.saveIncoming(
          channel,
          supportChat,
          data.message,
          manager,
        );

        if (savedMessage) {
          await this.supportChatsRepository.updateLastMessage(
            supportChat.id,
            savedMessage?.lastMessage,
            manager,
          );
          this.whatsappChatStateEmit({
            ...supportChat,
            last_message: savedMessage?.lastMessage.content,
            last_message_type: savedMessage?.lastMessage.type,
            last_message_id: savedMessage?.lastMessage.id,
          });

          this.whatsappService.emitEvent('whatsapp:messages', savedMessage);
        }
      } catch (err) {
        this.logger.error(`Erro ao processar mensagem: ${err.message}`);
        throw err;
      }
    });
  }

  async onMessageAck(payload: WhatsappWebhookPayload<MessagePayload>) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const { sessionId, data } = payload;
        const channel = await this.channelsService.getChannelBySessionId(sessionId);
        const phoneContact = data.message.id.remote;

        const contact = await manager.findOneBy(Contacts, {
          remote_jid: phoneContact,
        });

        const supportChat = await this.findOrOpen(contact.id, channel.id, manager);

        const savedMessage = await this.messagesService.saveMessageAck(
          supportChat.id,
          data.message,
          manager,
        );

        if (savedMessage) {
          this.whatsappService.emitEvent('whatsapp:message_ack', savedMessage);
        }
      } catch (err) {
        this.logger.error(`Erro ao processar mensagem ack: ${err.message}`);
        throw err;
      }
    });
  }

  async onMessageEdit(payload: WhatsappWebhookPayload<MessageEditPayload>) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const { sessionId, data } = payload;
        const channel = await this.channelsService.getChannelBySessionId(sessionId);
        const phoneContact = data.message.id.remote;

        const contact = await manager.findOneBy(Contacts, {
          remote_jid: phoneContact,
        });

        const supportChat = await this.findOrOpen(contact.id, channel.id, manager);

        const savedMessage = await this.messagesService.saveMessageEdited(
          supportChat,
          data.message,
          manager,
        );

        if (savedMessage) {
          await this.supportChatsRepository.updateLastMessage(
            supportChat.id,
            savedMessage?.lastMessage,
            manager,
          );
          this.whatsappChatStateEmit({
            ...supportChat,
            last_message: savedMessage?.lastMessage.content,
            last_message_type: savedMessage?.lastMessage.type,
            last_message_id: savedMessage?.lastMessage.id,
          });
          this.whatsappService.emitEvent('whatsapp:messages', savedMessage);
        }
      } catch (err) {
        this.logger.error(`Erro ao processar mensagem: ${err.message}`);
        throw err;
      }
    });
  }

  async onMessageRevokeEveryone(payload: WhatsappWebhookPayload<MessageEditPayload>) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const { sessionId, data } = payload;
        const channel = await this.channelsService.getChannelBySessionId(sessionId);
        const phoneContact = data.message.protocolMessageKey.remote;

        const contact = await manager.findOneBy(Contacts, {
          remote_jid: phoneContact,
        });

        const supportChat = await this.findOrOpen(contact.id, channel.id, manager);

        const savedMessage = await this.messagesService.saveMessageRevokeEveryone(
          supportChat,
          data.message,
          manager,
        );

        if (savedMessage) {
          await this.supportChatsRepository.updateLastMessage(
            supportChat.id,
            savedMessage?.lastMessage,
            manager,
          );
          this.whatsappChatStateEmit({
            ...supportChat,
            last_message: savedMessage?.lastMessage.content,
            last_message_type: savedMessage?.lastMessage.type,
            last_message_id: savedMessage?.lastMessage.id,
          });
          this.whatsappService.emitEvent('whatsapp:messages', savedMessage);
        }
      } catch (err) {
        this.logger.error(`Erro ao processar mensagem: ${err.message}`);
        throw err;
      }
    });
  }

  async onMessageReaction(payload: WhatsappWebhookPayload<ReactionPayload>) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const { sessionId, data } = payload;
        const channel = await this.channelsService.getChannelBySessionId(sessionId);
        const phoneContact = data.reaction.msgId.remote;

        const contact = await manager.findOneBy(Contacts, {
          remote_jid: phoneContact,
        });

        const supportChat = await this.findOrOpen(contact.id, channel.id, manager);

        const savedMessage = await this.messagesService.saveMessageReaction(
          supportChat.id,
          data.reaction,
          manager,
        );

        if (savedMessage) {
          this.whatsappService.emitEvent('whatsapp:messages', savedMessage);
        }
      } catch (err) {
        this.logger.error(`Erro ao processar mensagem: ${err.message}`);
        throw err;
      }
    });
  }

  async onMessagesUnreadCount(payload: WhatsappWebhookPayload<ChatPayload>) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const { sessionId, data } = payload;
        const channel = await this.channelsService.getChannelBySessionId(sessionId);
        const phoneContact = data.chat.id._serialized;

        const contact = await manager.findOneBy(Contacts, {
          remote_jid: phoneContact,
        });

        const supportChat = await this.findOrOpen(contact.id, channel.id, manager);

        await manager.update(SupportChats, supportChat.id, {
          unread_count: data.chat.unreadCount || 0,
        });

        this.whatsappService.emitEvent('whatsapp:unread_count', {
          chatId: supportChat.id,
          unreadCount: data.chat.unreadCount || 0,
        });
      } catch (err) {
        this.logger.error(`Erro ao processar mensagem: ${err.message}`);
        throw err;
      }
    });
  }

  async findOrOpen(
    contact_id: number,
    channel_id: number,
    manager: EntityManager,
    user_id?: number,
  ) {
    return await this.supportChatsRepository.findOrOpen(contact_id, channel_id, manager, user_id);
  }

  whatsappChatStateEmit(supportChat: SupportChats) {
    this.whatsappService.emitEvent('whatsapp:chat_state', supportChat);
  }
}
