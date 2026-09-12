import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SupportChatMessages } from './entities/support-chat-messages.entity';

@Injectable()
export class MessagesRepository extends Repository<SupportChatMessages> {
  constructor(dataSource: DataSource) {
    super(SupportChatMessages, dataSource.manager);
  }

  async findOneBySupportChatIdAndMessageId(
    support_chat_id: number,
    message_id: string,
  ): Promise<SupportChatMessages | null> {
    return this.findOneBy({
      support_chat_id,
      message_id,
    });
  }

  /**
   * Localiza pela chave da mensagem no provider, que tem constraint UNIQUE.
   *
   * Usado nos acks: o `messages.update` da Evolution traz o `remoteJid` no
   * formato `@lid` (identificador novo do WhatsApp), que não corresponde ao
   * `remote_jid` gravado no contato - então não dá para chegar à conversa pelo
   * JID. O id da mensagem, esse sim, é estável nos dois sentidos.
   */
  async findOneByMessageId(message_id: string): Promise<SupportChatMessages | null> {
    return this.findOneBy({ message_id });
  }
}
