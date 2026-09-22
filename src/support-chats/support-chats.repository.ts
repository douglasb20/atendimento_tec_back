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
        'contact.client.tags',
        // Os campos personalizados aparecem no painel de detalhes do chat. A
        // definição de cada um (nome, tipo) vem junto: a relação com
        // `CustomFields` é eager.
        'contact.camposPersonalizados',
        'contact.client.camposPersonalizados',
        'channel',
        'supportChatMessages',
        'user',
        // O front decide pelo id do status, mas a relação traz o rótulo legível.
        'supportChatStatus',
      ],
    });

    return supportChat;
  }

  /**
   * Quantos atendimentos anteriores este contato tem, e qual é o próximo.
   *
   * Não traz mensagem nenhuma: é chamado ao abrir toda conversa, só para saber
   * se existe histórico a oferecer. Carregar as mensagens aqui faria toda
   * abertura pagar o custo do histórico inteiro, inclusive de quem nunca vai
   * clicar no botão.
   *
   * O filtro é por `contact_id`, nunca por telefone ou nome: dois contatos
   * podem ter o mesmo nome, e o vínculo que vale é o registro.
   */
  async contarAnteriores(
    support_chat_id: number,
    antes_de?: number,
  ): Promise<{ total: number; proximo: SupportChats | null }> {
    const atual = await this.findOne({
      where: { id: support_chat_id },
      select: { id: true, contact_id: true },
    });

    if (!atual) return { total: 0, proximo: null };

    // `id <` e não data: os ids são sequenciais e é por eles que a ordem de
    // criação se define sem ambiguidade - duas conversas abertas no mesmo
    // segundo teriam a mesma data.
    const limite = antes_de ?? support_chat_id;

    const query = this.createQueryBuilder('sc')
      .where('sc.contact_id = :contact_id', { contact_id: atual.contact_id })
      .andWhere('sc.id < :limite', { limite })
      .orderBy('sc.id', 'DESC');

    const total = await query.getCount();
    const proximo = total > 0 ? await query.clone().take(1).getOne() : null;

    return { total, proximo };
  }

  /**
   * Um atendimento anterior, com suas mensagens.
   *
   * Um por chamada, e não uma página de N mensagens: a unidade que faz sentido
   * para quem atende é o atendimento inteiro, não "mais 50 linhas" cortadas no
   * meio de uma conversa.
   */
  async findAnteriorComMensagens(
    support_chat_id: number,
    antes_de: number,
  ): Promise<SupportChats | null> {
    const atual = await this.findOne({
      where: { id: support_chat_id },
      select: { id: true, contact_id: true },
    });

    if (!atual) return null;

    const anterior = await this.createQueryBuilder('sc')
      .where('sc.contact_id = :contact_id', { contact_id: atual.contact_id })
      .andWhere('sc.id < :antes_de', { antes_de })
      .orderBy('sc.id', 'DESC')
      .take(1)
      .getOne();

    if (!anterior) return null;

    // Recarregado com as relações: o query builder acima serve para achar
    // *qual* é o anterior, e trazer as mensagens junto ali complicaria a
    // ordenação sem ganho.
    return this.findOne({
      where: { id: anterior.id },
      order: { supportChatMessages: { datetime: 'ASC' } },
      relations: ['supportChatMessages', 'user', 'supportChatStatus'],
    });
  }

  /**
   * Como o `findOrOpen`, mas dizendo se a conversa nasceu agora.
   *
   * O `findOrOpen` devolve o mesmo tipo nos dois casos, e quem chama não tem
   * como distinguir - o que basta para gravar a mensagem, mas não para a
   * saudação automática, que só pode sair na abertura.
   *
   * Método à parte em vez de mudar a assinatura do outro: são três chamadores,
   * e só um precisa do sinal.
   */
  async findOrOpenComSinal(
    contact_id: number,
    channel_id: number,
    manager: EntityManager,
    user_id?: number,
  ): Promise<{ supportChat: SupportChats; criada: boolean }> {
    const existente = await this.buscaAberta(contact_id, channel_id);
    if (existente) return { supportChat: existente, criada: false };

    return { supportChat: await this.abre(contact_id, channel_id, manager, user_id), criada: true };
  }

  async findOrOpen(
    contact_id: number,
    channel_id: number,
    manager: EntityManager,
    user_id?: number,
  ): Promise<SupportChats> {
    return (
      (await this.buscaAberta(contact_id, channel_id)) ??
      (await this.abre(contact_id, channel_id, manager, user_id))
    );
  }

  /** A conversa ainda não finalizada deste contato neste canal, se houver. */
  private async buscaAberta(contact_id: number, channel_id: number): Promise<SupportChats | null> {
    return this.createQueryBuilder('sc')
      .innerJoin('support_chat_status', 'scs', 'scs.id = sc.support_chat_status_id')
      .leftJoinAndSelect('sc.contact', 'c')
      .leftJoinAndSelect('sc.channel', 'ch')
      .leftJoinAndSelect('sc.supportChatStatus', 'ms')
      .where('sc.contact_id = :contact_id', { contact_id })
      .andWhere('sc.channel_id = :channel_id', { channel_id })
      .andWhere('scs.is_final = false')
      .getOne();
  }

  private async abre(
    contact_id: number,
    channel_id: number,
    manager: EntityManager,
    user_id?: number,
  ): Promise<SupportChats> {
    const protocol = await this.protocolCountersRepository.generateProtocol(manager);

    return manager.save(
      SupportChats,
      manager.create(SupportChats, {
        user_id: user_id || null,
        channel_id,
        contact_id,
        support_chat_status_id: SupportChatStatusId.AGUARDANDO,
        protocol,
      }),
    );
  }

  /**
   * Conversa com tudo que descreve seu estado, sem as mensagens.
   *
   * É o formato canônico do evento `whatsapp:chat_state` e a resposta dos
   * endpoints de iniciar/finalizar: um shape único evita que o front receba
   * ora com `supportChatStatus`, ora sem.
   */
  async findParaEstado(id: number, manager?: EntityManager): Promise<SupportChats> {
    // O `manager` da transação em curso, quando há uma. Sem ele a leitura usa
    // uma conexão própria, que não enxerga o que ainda não foi commitado - na
    // primeira mensagem de um contato novo isso devolvia `null`, e a conversa
    // seguia pelo socket sem a relação `contact`: a lista lateral aparecia sem
    // nome e sem foto até o atendente recarregar a página.
    const repo = manager ? manager.getRepository(SupportChats) : this;

    return repo.findOne({
      where: { id },
      relations: [
        'contact',
        'contact.client',
        'contact.client.tags',
        // Os campos personalizados aparecem no painel de detalhes do chat. A
        // definição de cada um (nome, tipo) vem junto: a relação com
        // `CustomFields` é eager.
        'contact.camposPersonalizados',
        'contact.client.camposPersonalizados',
        'channel',
        'supportChatStatus',
        'user',
      ],
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
        // ⚠️ COALESCE, e não o valor direto: uma conversa devolvida para a
        // espera passa por aqui de novo quando alguém a reassume, e sobrescrever
        // reiniciaria o cronômetro. O tempo conta desde o primeiro atendimento,
        // porque mede a espera do cliente pela resolução - não o turno de quem
        // está com ela agora.
        answered_at: () => 'COALESCE("answered_at", :answered_at)',
        is_waiting: false,
        support_chat_status_id: SupportChatStatusId.EM_ANDAMENTO,
      })
      .setParameter('answered_at', answered_at)
      .where('id = :id AND support_chat_status_id IN (:...naoAssumidos)', {
        id,
        naoAssumidos: [SupportChatStatusId.AGUARDANDO, SupportChatStatusId.EM_FILA],
      })
      .execute();

    return resultado.affected ?? 0;
  }

  /**
   * Passa a conversa para outro atendente, ou de volta para a espera.
   *
   * `user_destino_id` nulo é o segundo caminho: a conversa perde o dono e volta
   * para "Aguardando", de onde qualquer um pode assumi-la.
   *
   * O WHERE exige o status **e** o dono atual: entre a validação no service e
   * este update, o outro atendente pode ter finalizado a conversa ou ela pode
   * já ter sido transferida. Nos dois casos o update não acha a linha, e o
   * service transforma o zero em conflito.
   *
   * ⚠️ `answered_at` fica intocado mesmo na volta para a espera - ver o
   * `assumir` acima.
   */
  async transferir(
    id: number,
    user_origem_id: number,
    user_destino_id: number | null,
    manager: EntityManager,
  ): Promise<number> {
    const resultado = await manager
      .createQueryBuilder()
      .update(SupportChats)
      .set({
        user_id: user_destino_id,
        is_waiting: user_destino_id === null,
        support_chat_status_id: user_destino_id
          ? SupportChatStatusId.EM_ANDAMENTO
          : SupportChatStatusId.AGUARDANDO,
      })
      .where('id = :id AND support_chat_status_id = :emAndamento AND user_id = :user_origem_id', {
        id,
        emAndamento: SupportChatStatusId.EM_ANDAMENTO,
        user_origem_id,
      })
      .execute();

    return resultado.affected ?? 0;
  }

  /** Encerra a conversa. Só sai de "Em andamento", pelo mesmo motivo do `assumir`. */
  /**
   * Encerra sem que tenha havido atendimento.
   *
   * Grava o status **4** (`FINALIZADO_SEM_RESPOSTA`), que existia no seed e
   * nenhum código atribuía: é o caso do spam de marketing e do contato que não
   * será atendido. Distinto do 5 nos relatórios - contar um descarte como
   * atendimento encerrado inflaria o volume.
   *
   * O UPDATE condicional aceita **Aguardando e Em fila**, não `EM_ANDAMENTO`:
   * quem já assumiu a conversa usa `finalizar`. `affected = 0` significa que
   * alguém assumiu no meio do caminho, e quem chama arbitra a corrida.
   */
  async finalizarSemAtendimento(
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
        support_chat_status_id: SupportChatStatusId.FINALIZADO_SEM_RESPOSTA,
      })
      .where('id = :id AND support_chat_status_id IN (:...abertos)', {
        id,
        abertos: [SupportChatStatusId.AGUARDANDO, SupportChatStatusId.EM_FILA],
      })
      .execute();

    return resultado.affected ?? 0;
  }

  /**
   * Devolve a conversa ao estado de não lida, com o contador em 1.
   *
   * O valor real não importa: a lista mostra um badge, não a contagem exata, e
   * o gesto é "marcar para ver depois". Mais importante é que qualquer mensagem
   * nova soma a partir daqui, em vez de recomeçar do zero.
   */
  async marcarComoNaoLida(id: number, manager: EntityManager): Promise<number> {
    const resultado = await manager
      .createQueryBuilder()
      .update(SupportChats)
      .set({ unread_count: 1 })
      .where('id = :id', { id })
      .execute();

    return resultado.affected ?? 0;
  }

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
   * reflete qualquer aparelho conectado à conta - se alguém abre no celular, a
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
    // as linhas direto - acessar `resultado[0].unread_count` pega o array e
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
