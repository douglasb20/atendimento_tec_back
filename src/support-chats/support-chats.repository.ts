import { Injectable } from '@nestjs/common';
import { MessageWithLastMessage } from '@types';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { SupportChats } from './entities/support-chats.entity';
import { ProtocolCountersRepository } from './protocol-counters.repository';

@Injectable()
export class SupportChatsRepository extends Repository<SupportChats> {
  constructor(
    dataSource: DataSource,
    private readonly protocolCountersRepository: ProtocolCountersRepository,
  ) {
    super(SupportChats, dataSource.manager);
  }

  async findActives() {
    return this.findBy({ support_chat_status_id: 1 });
  }

  async findAllSupportChats() {
    let supportChat = await this.createQueryBuilder('sc')
      // .select('sc.*')
      .leftJoinAndSelect('sc.contact', 'c')
      .leftJoinAndSelect('sc.channel', 'ch')
      .leftJoinAndSelect('c.client', 'cl')
      .leftJoinAndSelect('sc.supportChatStatus', 'ms')
      .innerJoin('support_chat_status', 'scs', 'scs.id = sc.support_chat_status_id')
      .andWhere('scs.is_final = false')
      // Conversa com mensagem mais recente primeiro, como em qualquer
      // mensageiro. A data vem por subconsulta em vez do `updated_at` porque
      // este muda em qualquer alteração da conversa (status, atribuição) e
      // reordenaria a lista por motivos que o atendente não vê.
      .addSelect(
        (sub) =>
          sub
            .select('MAX(m.datetime)')
            .from('support_chat_messages', 'm')
            .where('m.support_chat_id = sc.id'),
        'ultima_mensagem_em',
      )
      // NULLS LAST mantém no fim a conversa aberta que ainda não tem mensagem.
      .orderBy('"ultima_mensagem_em"', 'DESC', 'NULLS LAST')
      .getMany();

    return supportChat;
  }

  async findSupportChatsById(id: number): Promise<SupportChats> {
    let supportChat = await this.findOne({
      where: { id },
      order: { supportChatMessages: { datetime: 'ASC' } },
      relations: ['contact', 'contact.client', 'channel', 'supportChatMessages', 'user'],
    });

    return supportChat;
  }

  async findOrOpen(
    contact_id: number,
    channel_id: number,
    manager: EntityManager,
    user_id?: number,
  ): Promise<SupportChats> {
    let supportChat = await this.createQueryBuilder('sc')
      .innerJoin('support_chat_status', 'scs', 'scs.id = sc.support_chat_status_id')
      .leftJoinAndSelect('sc.contact', 'c')
      .leftJoinAndSelect('sc.channel', 'ch')
      .leftJoinAndSelect('sc.supportChatStatus', 'ms')
      .where('sc.contact_id = :contact_id', { contact_id })
      .andWhere('sc.channel_id = :channel_id', { channel_id })
      .andWhere('scs.is_final = false')
      .getOne();

    if (!supportChat) {
      const protocol = await this.protocolCountersRepository.generateProtocol(manager);
      const supportChatToSave = manager.create(SupportChats, {
        user_id: user_id || null,
        channel_id,
        contact_id,
        support_chat_status_id: 1, // aberto
        protocol,
      });

      supportChat = await manager.save(SupportChats, supportChatToSave);
    }
    return supportChat;
  }

  async updateLastMessage(
    support_chat_id: number,
    lastMessage: MessageWithLastMessage['lastMessage'],
    manager: EntityManager,
  ) {
    if (!lastMessage) {
      return;
    }

    await manager.update(SupportChats, support_chat_id, {
      last_message: lastMessage.content,
      last_message_type: lastMessage.type,
      last_message_id: lastMessage.id,
    });
  }
}
