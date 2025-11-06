import { Injectable, Logger } from '@nestjs/common';
import { WhatsappService } from 'whatsapp/whatsapp.service';
// import { MessagesService } from './messages/messages.service';
import { MessagePayload, WhatsappWebhookPayload } from '@types';
import { ChannelsService } from 'channels/channels.service';
import { ContactsService } from 'contacts/contacts.service';
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
      let phoneContact = '';
      if (data.message.fromMe) {
        phoneContact = data.message.to;
      } else {
        phoneContact = data.message.from;
      }
      const contact = await this.contactsService.findOrCreateByRemoteJid({
        sessionId,
        remote_jid: phoneContact,
        name: data.message._data?.notifyName,
      });

      const supportChat = await this.findOrOpen(contact.id, channel.id);

      const savedMessage = await this.messagesService.saveIncoming(
        supportChat.id,
        channel.id,
        data.message,
      );

      await this.supportChatsRepository.updateLastMessage(supportChat.id, savedMessage);

      this.whatsappService.emitEvent('whatsapp:messages', savedMessage);
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
