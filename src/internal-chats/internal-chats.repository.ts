import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, In, IsNull, Not, Repository } from 'typeorm';

import { Users } from '@/users/entities/users.entity';
import { InternalChatMessages } from './entities/internal-chat-messages.entity';
import { InternalChats } from './entities/internal-chats.entity';
import { ordenarPar } from './internal-chat.types';

/** Uma conversa com o outro lado e o que a lista precisa mostrar. */
export type ConversaComResumo = {
  id: number;
  outro: Users;
  last_message_at: Date | null;
  ultima_mensagem: InternalChatMessages | null;
  nao_lidas: number;
};

@Injectable()
export class InternalChatsRepository extends Repository<InternalChats> {
  constructor(protected dataSource: DataSource) {
    super(InternalChats, dataSource.manager);
  }

  /**
   * A conversa entre duas pessoas, criando-a se ainda não existir.
   *
   * Recebe o `manager` da transação em curso: quem envia a primeira mensagem
   * cria a conversa e grava a mensagem no mesmo commit - se a segunda falhasse,
   * ficaria uma conversa vazia na lista do outro.
   *
   * ⚠️ **A corrida é real.** Duas pessoas escrevendo uma para a outra ao mesmo
   * tempo chegam aqui juntas, as duas não acham nada, e as duas inserem. Quem
   * perder leva violação do índice único - e é por isso que a segunda tentativa
   * relê em vez de propagar o erro. Tratar como conflito seria pedir ao usuário
   * que reenviasse uma mensagem que só falhou por sincronia.
   */
  async findOrCreateConversa(
    manager: EntityManager,
    umUsuario: number,
    outroUsuario: number,
  ): Promise<InternalChats> {
    const [user_a_id, user_b_id] = ordenarPar(umUsuario, outroUsuario);

    const existente = await manager.findOne(InternalChats, { where: { user_a_id, user_b_id } });
    if (existente) return existente;

    try {
      return await manager.save(manager.create(InternalChats, { user_a_id, user_b_id }));
    } catch {
      // O outro lado criou entre o find e o save. A conversa dele é a nossa.
      const criadaPeloOutro = await manager.findOne(InternalChats, {
        where: { user_a_id, user_b_id },
      });

      if (!criadaPeloOutro) throw new NotFoundException('Não foi possível abrir a conversa');

      return criadaPeloOutro;
    }
  }

  /** A conversa de que este usuário participa, ou `null`. */
  async findMinhaConversa(id: number, usuarioId: number): Promise<InternalChats | null> {
    const conversa = await this.findOne({ where: { id } });
    if (!conversa) return null;

    // A checagem que impede ler a conversa alheia trocando o id na URL. A
    // permissão diz "pode usar o chat interno"; esta linha diz "esta conversa é
    // sua".
    const souParte = conversa.user_a_id === usuarioId || conversa.user_b_id === usuarioId;

    return souParte ? conversa : null;
  }

  /**
   * As conversas de um usuário, com o outro lado, a última mensagem e as não
   * lidas.
   *
   * Três consultas em vez de uma com subselects: a lista é curta (uma linha por
   * colega com quem já se conversou) e o ganho de uma consulta só não paga a
   * dificuldade de ler o SQL depois.
   */
  async listarConversas(usuarioId: number): Promise<ConversaComResumo[]> {
    const conversas = await this.find({
      where: [{ user_a_id: usuarioId }, { user_b_id: usuarioId }],
      relations: ['userA', 'userB'],
      order: { last_message_at: 'DESC' },
    });

    if (!conversas.length) return [];

    const ids = conversas.map((c) => c.id);

    // A última mensagem de cada conversa, num só `DISTINCT ON`.
    const ultimas = await this.manager
      .createQueryBuilder(InternalChatMessages, 'm')
      .distinctOn(['m.internal_chat_id'])
      .where('m.internal_chat_id IN (:...ids)', { ids })
      .orderBy('m.internal_chat_id')
      .addOrderBy('m.created_at', 'DESC')
      .getMany();

    const ultimaPorConversa = new Map(ultimas.map((m) => [String(m.internal_chat_id), m]));

    // Não lidas: as que o **outro** mandou e ainda não foram lidas.
    const naoLidas = await this.manager
      .createQueryBuilder(InternalChatMessages, 'm')
      .select('m.internal_chat_id', 'chat_id')
      .addSelect('COUNT(*)', 'total')
      .where('m.internal_chat_id IN (:...ids)', { ids })
      .andWhere('m.sender_id != :usuarioId', { usuarioId })
      .andWhere('m.read_at IS NULL')
      .groupBy('m.internal_chat_id')
      .getRawMany<{ chat_id: string; total: string }>();

    const naoLidasPorConversa = new Map(naoLidas.map((r) => [String(r.chat_id), Number(r.total)]));

    return conversas.map((conversa) => ({
      id: conversa.id,
      outro: conversa.user_a_id === usuarioId ? conversa.userB : conversa.userA,
      last_message_at: conversa.last_message_at,
      ultima_mensagem: ultimaPorConversa.get(String(conversa.id)) ?? null,
      nao_lidas: naoLidasPorConversa.get(String(conversa.id)) ?? 0,
    }));
  }

  /**
   * As mensagens de uma conversa, das mais recentes para as mais antigas.
   *
   * Pagina por `antesDe` (o `created_at` da mais antiga já carregada) em vez de
   * `offset`: com mensagem nova chegando durante a rolagem, o offset repetiria
   * ou puliria linhas.
   */
  async listarMensagens(
    conversaId: number,
    limite: number,
    antesDe?: Date,
  ): Promise<InternalChatMessages[]> {
    const query = this.manager
      .createQueryBuilder(InternalChatMessages, 'm')
      .leftJoinAndSelect('m.sender', 'sender')
      .where('m.internal_chat_id = :conversaId', { conversaId })
      .orderBy('m.created_at', 'DESC')
      .take(limite);

    if (antesDe) query.andWhere('m.created_at < :antesDe', { antesDe });

    return query.getMany();
  }

  /**
   * Marca como lidas as mensagens que o outro mandou.
   *
   * @returns quantas mudaram de estado. Zero significa que não havia nada por
   * ler - e quem chama usa isso para não emitir evento à toa.
   */
  async marcarLidas(conversaId: number, usuarioId: number): Promise<number> {
    const resultado = await this.manager.update(
      InternalChatMessages,
      // Só as do outro: marcar as próprias como lidas não faz sentido e
      // apagaria o "não lida" do destinatário.
      { internal_chat_id: conversaId, sender_id: Not(usuarioId), read_at: IsNull() },
      { read_at: new Date() },
    );

    return resultado.affected ?? 0;
  }

  /** Total de mensagens não lidas do usuário, em todas as conversas. */
  async contarNaoLidasTotal(usuarioId: number): Promise<number> {
    const conversas = await this.find({
      where: [{ user_a_id: usuarioId }, { user_b_id: usuarioId }],
      select: ['id'],
    });

    if (!conversas.length) return 0;

    return this.manager.count(InternalChatMessages, {
      where: {
        internal_chat_id: In(conversas.map((c) => c.id)),
        sender_id: Not(usuarioId),
        read_at: IsNull(),
      },
    });
  }
}
