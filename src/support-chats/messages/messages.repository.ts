import { Injectable } from '@nestjs/common';
import { DataSource, Repository, LessThan } from 'typeorm';
import { MessageAck } from '@types';
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
  /**
   * Mensagens recebidas ainda não marcadas como lidas no WhatsApp.
   *
   * O teto existe porque o provider recebe todas as chaves num corpo só, e uma
   * conversa esquecida pode ter centenas de pendências.
   */
  async findNaoLidasParaMarcar(
    support_chat_id: number,
    limite = 50,
  ): Promise<SupportChatMessages[]> {
    return this.find({
      where: {
        support_chat_id,
        from_me: false,
        ack: LessThan(MessageAck.ACK_READ),
      },
      order: { datetime: 'DESC' },
      take: limite,
    });
  }

  async findOneByMessageId(message_id: string): Promise<SupportChatMessages | null> {
    return this.findOneBy({ message_id });
  }
}
