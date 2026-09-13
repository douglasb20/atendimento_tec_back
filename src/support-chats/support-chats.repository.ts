import { Injectable } from '@nestjs/common';
import { MessageWithLastMessage, SupportChatStatusId } from '@types';
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
      // Quem assumiu a conversa, para a lista poder separar "meus atendimentos".
      .leftJoinAndSelect('sc.user', 'u')
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
      relations: [
        'contact',
        'contact.client',
        'channel',
        'supportChatMessages',
        'user',
        // O front decide pelo id do status, mas a relação traz o rótulo legível.
        'supportChatStatus',
      ],
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
        support_chat_status_id: SupportChatStatusId.AGUARDANDO,
        protocol,
      });

      supportChat = await manager.save(SupportChats, supportChatToSave);
    }
    return supportChat;
  }

  /**
   * Conversa com tudo que descreve seu estado, sem as mensagens.
   *
   * É o formato canônico do evento `whatsapp:chat_state` e a resposta dos
   * endpoints de iniciar/finalizar: um shape único evita que o front receba
   * ora com `supportChatStatus`, ora sem.
   */
  async findParaEstado(id: number): Promise<SupportChats> {
    return this.findOne({
      where: { id },
      relations: ['contact', 'contact.client', 'channel', 'supportChatStatus', 'user'],
    });
  }

  /**
   * Atribui a conversa a um atendente.
   *
   * O status entra no WHERE de propósito: dois atendentes clicando em Iniciar
   * ao mesmo tempo fariam o segundo sobrescrever `user_id` e `answered_at`.
   * Assim o banco decide quem chegou primeiro, e o perdedor recebe 0 linhas.
   */
  async assumir(
    id: number,
    user_id: number,
    answered_at: Date,
    manager: EntityManager,
  ): Promise<number> {
    const resultado = await manager
      .createQueryBuilder()
      .update(SupportChats)
      .set({
        user_id,
        answered_at,
        is_waiting: false,
        support_chat_status_id: SupportChatStatusId.EM_ANDAMENTO,
      })
      .where('id = :id AND support_chat_status_id IN (:...naoAssumidos)', {
        id,
        naoAssumidos: [SupportChatStatusId.AGUARDANDO, SupportChatStatusId.EM_FILA],
      })
      .execute();

    return resultado.affected ?? 0;
  }

  /** Encerra a conversa. Só sai de "Em andamento", pelo mesmo motivo do `assumir`. */
  async finalizar(
    id: number,
    finished_at: Date,
    observation_user: string | null,
    manager: EntityManager,
  ): Promise<number> {
    const resultado = await manager
      .createQueryBuilder()
      .update(SupportChats)
      .set({
        finished_at,
        observation_user,
        is_waiting: false,
        unread_count: 0,
        support_chat_status_id: SupportChatStatusId.FINALIZADO,
      })
      .where('id = :id AND support_chat_status_id = :emAndamento', {
        id,
        emAndamento: SupportChatStatusId.EM_ANDAMENTO,
      })
      .execute();

    return resultado.affected ?? 0;
  }

  /**
   * Soma uma mensagem não lida à conversa.
   *
   * A contagem é nossa, não a do WhatsApp: o `chats.update` da Evolution chega
   * sem `unreadCount` (só `remoteJid` e `instanceId`), e o "lido" do protocolo
   * reflete qualquer aparelho conectado à conta — se alguém abre no celular, a
   * mensagem fica lida sem nenhum atendente ter visto. Aqui, não lida significa
   * que ninguém abriu a conversa no painel.
   */
  async incrementaNaoLidas(support_chat_id: number, manager: EntityManager): Promise<number> {
    // Incremento e leitura na mesma instrução: o `RETURNING` evita a segunda
    // consulta e garante o valor pós-update, mesmo com duas mensagens
    // chegando ao mesmo tempo.
    const resultado = await manager.query(
      `UPDATE support_chats
          SET unread_count = unread_count + 1
        WHERE id = $1
      RETURNING unread_count`,
      [support_chat_id],
    );

    // Num UPDATE ... RETURNING, o driver devolve `[linhas, quantidade]`, e não
    // as linhas direto — acessar `resultado[0].unread_count` pega o array e
    // resulta em undefined. As duas formas são aceitas aqui porque o retorno
    // varia entre versões do driver.
    const linhas = Array.isArray(resultado?.[0]) ? resultado[0] : resultado;

    return Number(linhas?.[0]?.unread_count ?? 0);
  }

  /** Zera a contagem quando o atendente abre a conversa. */
  async zeraNaoLidas(support_chat_id: number): Promise<void> {
    await this.update({ id: support_chat_id }, { unread_count: 0 });
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
