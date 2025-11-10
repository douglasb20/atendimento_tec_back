import { Injectable, Logger } from '@nestjs/common';

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
import { ProtocolCountersRepository } from './protocol-counters.repository';
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
    private readonly protocolCountersRepository: ProtocolCountersRepository,
  ) {}

  async sendMessage(to: string, message: string) {
    this.logger.log(`Enviando mensagem de para ${to} com mensagem: ${message}`);
    this.whatsappService.sendMessage('1', to, message);
  }

  // ====== Event Listeners Handles ======
  async onMessageCreate(payload: WhatsappWebhookPayload<MessagePayload>) {
    try {
      const { sessionId, data } = payload;
      const channel = await this.channelsService.getChannelBySessionId(sessionId);
      let phoneContact = data.message.id.remote;

      const contact = await this.contactsService.findOrCreateByRemoteJid({
        sessionId,
        remote_jid: phoneContact,
        name: data.message._data?.notifyName,
      });

      const supportChat = await this.findOrOpen(contact.id, channel.id);

      const savedMessage = await this.messagesService.saveIncoming(
        channel,
        supportChat,
        data.message,
      );

      if (savedMessage) {
        await this.supportChatsRepository.updateLastMessage(
          supportChat.id,
          savedMessage?.lastMessage,
        );

        this.whatsappService.emitEvent('whatsapp:messages', savedMessage);
      }
    } catch (err) {
      this.logger.error(`Erro ao processar mensagem: ${err.message}`);
    }
  }

  async onMessageAck(payload: WhatsappWebhookPayload<MessagePayload>) {
    try {
      const { sessionId, data } = payload;
      const channel = await this.channelsService.getChannelBySessionId(sessionId);
      let phoneContact = data.message.id.remote;

      const contact = await this.contactsService.findOrCreateByRemoteJid({
        sessionId,
        remote_jid: phoneContact,
        name: data.message._data?.notifyName,
      });

      const supportChat = await this.findOrOpen(contact.id, channel.id);

      const savedMessage = await this.messagesService.saveMessageAck(supportChat.id, data.message);

      if (savedMessage) {
        this.whatsappService.emitEvent('whatsapp:message_ack', savedMessage);
      }
    } catch (err) {
      this.logger.error(`Erro ao processar mensagem: ${err.message}`);
    }
  }

  async onMessageEdit(payload: WhatsappWebhookPayload<MessageEditPayload>) {
    try {
      const { sessionId, data } = payload;
      const channel = await this.channelsService.getChannelBySessionId(sessionId);
      let phoneContact = data.message.id.remote;

      const contact = await this.contactsService.findOrCreateByRemoteJid({
        sessionId,
        remote_jid: phoneContact,
        name: data.message._data?.notifyName,
      });

      const supportChat = await this.findOrOpen(contact.id, channel.id);

      const savedMessage = await this.messagesService.saveMessageEdited(supportChat, data.message);

      if (savedMessage) {
        await this.supportChatsRepository.updateLastMessage(
          supportChat.id,
          savedMessage?.lastMessage,
        );
        this.whatsappService.emitEvent('whatsapp:message_edit', savedMessage);
      }
    } catch (err) {
      this.logger.error(`Erro ao processar mensagem: ${err.message}`);
    }
  }

  async onMessageRevokeEveryone(payload: WhatsappWebhookPayload<MessageEditPayload>) {
    try {
      const { sessionId, data } = payload;
      const channel = await this.channelsService.getChannelBySessionId(sessionId);
      let phoneContact = data.message.protocolMessageKey.remote;

      const contact = await this.contactsService.findOrCreateByRemoteJid({
        sessionId,
        remote_jid: phoneContact,
      });

      const supportChat = await this.findOrOpen(contact.id, channel.id);

      const savedMessage = await this.messagesService.saveMessageRevokeEveryone(
        supportChat,
        data.message,
      );

      if (savedMessage) {
        await this.supportChatsRepository.updateLastMessage(
          supportChat.id,
          savedMessage?.lastMessage,
        );
        this.whatsappService.emitEvent('whatsapp:message_revoke_everyone', savedMessage);
      }
    } catch (err) {
      this.logger.error(`Erro ao processar mensagem: ${err.message}`);
    }
  }

  async onMessagesUnreadCount(payload: WhatsappWebhookPayload<ChatPayload>) {
    try {
      const { sessionId, data } = payload;
      const channel = await this.channelsService.getChannelBySessionId(sessionId);

      const contact = await this.contactsService.findOrCreateByRemoteJid({
        sessionId,
        remote_jid: data.chat.id._serialized,
        name: data.chat.name,
      });

      const supportChat = await this.findOrOpen(contact.id, channel.id);

      await this.supportChatsRepository.update(supportChat.id, {
        unread_count: data.chat.unreadCount || 0,
      });

      this.whatsappService.emitEvent('whatsapp:unread_count', {
        chatId: data.chat.id._serialized,
        unreadCount: data.chat.unreadCount || 0,
      });
    } catch (err) {
      this.logger.error(`Erro ao processar mensagem: ${err.message}`);
    }
  }

  async onMessageReaction(payload: WhatsappWebhookPayload<ReactionPayload>) {
    try {
      const { sessionId, data } = payload;
      const channel = await this.channelsService.getChannelBySessionId(sessionId);
      let phoneContact = data.reaction.msgId.remote;

      const contact = await this.contactsService.findOrCreateByRemoteJid({
        sessionId,
        remote_jid: phoneContact,
      });

      const supportChat = await this.findOrOpen(contact.id, channel.id);

      const savedMessage = await this.messagesService.saveMessageReaction(
        supportChat.id,
        data.reaction,
      );

      if (savedMessage) {
        this.whatsappService.emitEvent('whatsapp:message_ack', savedMessage);
      }
    } catch (err) {
      this.logger.error(`Erro ao processar mensagem: ${err.message}`);
    }
  }

  async findOrOpen(contact_id: number, channel_id: number, user_id?: number) {
    let supportChat = await this.supportChatsRepository
      .createQueryBuilder('sc')
      .select('sc.*')
      .innerJoin('support_chat_status', 'scs', 'scs.id = sc.support_chat_status_id')
      .where('sc.contact_id = :contact_id', { contact_id })
      .andWhere('sc.channel_id = :channel_id', { channel_id })
      .andWhere('scs.is_final = 0')
      .getRawOne();

    const protocol = await this.protocolCountersRepository.generateProtocol();

    if (!supportChat) {
      supportChat = this.supportChatsRepository.create({
        user_id: user_id || null,
        channel_id,
        contact_id,
        support_chat_status_id: 1, // aberto
        protocol,
      });

      await this.supportChatsRepository.save(supportChat);
    }

    return supportChat;
  }
}
