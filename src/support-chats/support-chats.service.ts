import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';

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

import { MessagesService } from './messages/messages.service';
import { SupportChatsRepository } from './support-chats.repository';
import { SupportChats } from './entities/support-chats.entity';

@Injectable()
export class SupportChatsService {
  private queryRunner: QueryRunner;
  private readonly logger = new Logger(SupportChatsService.name);

  constructor(
    private readonly whatsappService: WhatsappService,
    private readonly messagesService: MessagesService,
    private readonly channelsService: ChannelsService,
    private readonly contactsService: ContactsService,
    private readonly supportChatsRepository: SupportChatsRepository,
    private readonly dataSource: DataSource,
  ) {
    this.queryRunner = this.dataSource.createQueryRunner();
  }

  async sendMessage(to: string, message: string) {
    this.logger.log(`Enviando mensagem de para ${to} com mensagem: ${message}`);
    this.whatsappService.sendMessage('1', to, message);
  }

  async listAllSupportChats() {
    return this.supportChatsRepository.findAllSupportChats();
  }

  // ====== Event Listeners Handles ======
  async onMessageCreate(payload: WhatsappWebhookPayload<MessagePayload>) {
    try {
      await this.queryRunner.startTransaction();
      const manager: EntityManager = this.queryRunner.manager;

      const { sessionId, data } = payload;
      const channel = await this.channelsService.getChannelBySessionId(sessionId);
      let phoneContact = data.message.id.remote;

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

        this.whatsappService.emitEvent('whatsapp:messages', savedMessage);
      }
      await this.queryRunner.commitTransaction();
    } catch (err) {
      this.logger.error(`Erro ao processar mensagem: ${err.message}`);
      await this.queryRunner.rollbackTransaction();
    }
  }

  async onMessageAck(payload: WhatsappWebhookPayload<MessagePayload>) {
    try {
      await this.queryRunner.startTransaction();
      const manager: EntityManager = this.queryRunner.manager;

      const { sessionId, data } = payload;
      const channel = await this.channelsService.getChannelBySessionId(sessionId);
      let phoneContact = data.message.id.remote;

      const contact = await this.contactsService.findOrCreateByRemoteJid(
        {
          sessionId,
          remote_jid: phoneContact,
          name: data.message._data?.notifyName,
        },
        manager,
      );

      const supportChat = await this.findOrOpen(contact.id, channel.id, manager);

      const savedMessage = await this.messagesService.saveMessageAck(
        supportChat.id,
        data.message,
        manager,
      );

      if (savedMessage) {
        this.whatsappService.emitEvent('whatsapp:messages', savedMessage);
      }
      await this.queryRunner.commitTransaction();
    } catch (err) {
      this.logger.error(`Erro ao processar mensagem: ${err.message}`);
      await this.queryRunner.rollbackTransaction();
    }
  }

  async onMessageEdit(payload: WhatsappWebhookPayload<MessageEditPayload>) {
    try {
      await this.queryRunner.startTransaction();
      const manager: EntityManager = this.queryRunner.manager;

      const { sessionId, data } = payload;
      const channel = await this.channelsService.getChannelBySessionId(sessionId);
      let phoneContact = data.message.id.remote;

      const contact = await this.contactsService.findOrCreateByRemoteJid(
        {
          sessionId,
          remote_jid: phoneContact,
          name: data.message._data?.notifyName,
        },
        manager,
      );

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
        this.whatsappService.emitEvent('whatsapp:messages', savedMessage);
      }
      await this.queryRunner.commitTransaction();
    } catch (err) {
      this.logger.error(`Erro ao processar mensagem: ${err.message}`);
      await this.queryRunner.rollbackTransaction();
    }
  }

  async onMessageRevokeEveryone(payload: WhatsappWebhookPayload<MessageEditPayload>) {
    try {
      await this.queryRunner.startTransaction();
      const manager: EntityManager = this.queryRunner.manager;

      const { sessionId, data } = payload;
      const channel = await this.channelsService.getChannelBySessionId(sessionId);
      let phoneContact = data.message.protocolMessageKey.remote;

      const contact = await this.contactsService.findOrCreateByRemoteJid(
        {
          sessionId,
          remote_jid: phoneContact,
        },
        manager,
      );

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
        this.whatsappService.emitEvent('whatsapp:messages', savedMessage);
      }
      await this.queryRunner.commitTransaction();
    } catch (err) {
      this.logger.error(`Erro ao processar mensagem: ${err.message}`);
      await this.queryRunner.rollbackTransaction();
    }
  }

  async onMessageReaction(payload: WhatsappWebhookPayload<ReactionPayload>) {
    try {
      await this.queryRunner.startTransaction();
      const manager: EntityManager = this.queryRunner.manager;

      const { sessionId, data } = payload;
      const channel = await this.channelsService.getChannelBySessionId(sessionId);
      let phoneContact = data.reaction.msgId.remote;

      const contact = await this.contactsService.findOrCreateByRemoteJid(
        {
          sessionId,
          remote_jid: phoneContact,
        },
        manager,
      );

      const supportChat = await this.findOrOpen(contact.id, channel.id, manager);

      const savedMessage = await this.messagesService.saveMessageReaction(
        supportChat.id,
        data.reaction,
        manager,
      );

      if (savedMessage) {
        this.whatsappService.emitEvent('whatsapp:messages', savedMessage);
      }
      await this.queryRunner.commitTransaction();
    } catch (err) {
      this.logger.error(`Erro ao processar mensagem: ${err.message}`);
      await this.queryRunner.rollbackTransaction();
    }
  }

  async onMessagesUnreadCount(payload: WhatsappWebhookPayload<ChatPayload>) {
    try {
      await this.queryRunner.startTransaction();
      const manager: EntityManager = this.queryRunner.manager;

      const { sessionId, data } = payload;
      const channel = await this.channelsService.getChannelBySessionId(sessionId);

      const contact = await this.contactsService.findOrCreateByRemoteJid(
        {
          sessionId,
          remote_jid: data.chat.id._serialized,
          name: data.chat.name,
        },
        manager,
      );

      const supportChat = await this.findOrOpen(contact.id, channel.id, manager);

      await manager.update(SupportChats, supportChat.id, {
        unread_count: data.chat.unreadCount || 0,
      });

      this.whatsappService.emitEvent('whatsapp:unread_count', {
        chatId: data.chat.id._serialized,
        unreadCount: data.chat.unreadCount || 0,
      });
      await this.queryRunner.commitTransaction();
    } catch (err) {
      this.logger.error(`Erro ao processar mensagem: ${err.message}`);
      await this.queryRunner.rollbackTransaction();
    }
  }

  async findOrOpen(
    contact_id: number,
    channel_id: number,
    manager: EntityManager,
    user_id?: number,
  ) {
    return await this.supportChatsRepository.findOrOpen(contact_id, channel_id, manager, user_id);
  }
}
