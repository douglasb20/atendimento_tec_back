import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';

import { FUSO_EXIBICAO } from '@/core/fuso-exibicao';
import { SupportChats } from '@/support-chats/entities/support-chats.entity';
import {
  AttendanceSortBy,
  ClientReportGroupBy,
  ClientReportSortBy,
  ReportFilterDto,
} from './dto/report-filter.dto';

/** Uma linha do relatório de atendimentos, como sai da consulta. */
export type AttendanceRow = {
  id: string;
  protocolo: string;
  contato: string;
  telefone: string | null;
  cliente: string | null;
  atendente: string | null;
  setor: string | null;
  canal: string | null;
  aberto_em: Date;
  atendido_em: Date | null;
  finalizado_em: Date | null;
  /**
   * Segundos entre a resposta e o encerramento, **sem** o tempo pausado.
   * Nulo também quando ninguém assumiu - sem resposta não há atendimento a
   * medir, só a espera abaixo.
   */
  duracao_segundos: number | null;
  /**
   * Segundos entre a abertura e o momento em que alguém assumiu - ou, se
   * nunca foi assumido mas já foi finalizado, até o fechamento (o tempo que
   * a conversa passou esperando antes de ser encerrada sem resposta). Nulo
   * só enquanto a conversa segue aberta e sem dono.
   */
  espera_segundos: number | null;
  situacao: string;
};

/** Os números do rodapé, calculados sobre o filtro inteiro - não sobre a página. */
export type AttendanceTotals = {
  total: number;
  finalizados: number;
  em_aberto: number;
  /** Soma das durações dos atendimentos finalizados - usada no PDF, não na tela. */
  duracao_total_segundos: number;
  /** Soma das esperas de quem foi atendido - usada no PDF, não na tela. */
  espera_total_segundos: number;
  duracao_media_segundos: number | null;
  espera_media_segundos: number | null;
};

export type AttendanceReport = {
  linhas: AttendanceRow[];
  totais: AttendanceTotals;
};

/** Uma linha do relatório de produtividade, um atendente por linha. */
export type ProductivityRow = {
  atendente: string;
  total: number;
  finalizados: number;
  em_aberto: number;
  /** Mensagens digitadas pelo atendente nos atendimentos da linha - exclui as automáticas. */
  mensagens_enviadas: number;
  /** Soma das durações dos atendimentos finalizados - o tempo total que o atendente passou atendendo. */
  duracao_total_segundos: number;
  /** Soma das esperas de quem foi atendido - usada no total do Excel/PDF, não é "duração". */
  espera_total_segundos: number;
  duracao_media_segundos: number | null;
  espera_media_segundos: number | null;
};

/** Os totais do rodapé, somando as linhas (um atendente por linha). */
export type ProductivityTotals = {
  total: number;
  finalizados: number;
  em_aberto: number;
  mensagens_enviadas: number;
  /** Soma de `duracao_total_segundos` de todas as linhas - o tempo total do período inteiro. */
  duracao_total_segundos: number;
  /** Soma de `espera_total_segundos` de todas as linhas. */
  espera_total_segundos: number;
  /**
   * Soma de `duracao_media_segundos` de cada linha - literalmente o total da
   * coluna "Duração média" da tabela, e não o tempo total de atendimento
   * (que é `duracao_total_segundos`). Os dois só coincidem quando há um
   * atendente só.
   */
  soma_duracoes_medias_segundos: number;
  /** Mesma ideia de `soma_duracoes_medias_segundos`, para "Espera média". */
  soma_esperas_medias_segundos: number;
  duracao_media_segundos: number | null;
  espera_media_segundos: number | null;
};

export type ProductivityReport = {
  linhas: ProductivityRow[];
  totais: ProductivityTotals;
};

/**
 * Uma linha do relatório por cliente/contato - mesmas métricas de
 * produtividade, trocando "quem atendeu" por "quem foi atendido".
 */
export type ClientReportRow = {
  /**
   * O `id` do cliente ou do contato, conforme `agrupar_por` da linha - nulo
   * só na linha "Sem cliente" (agrupado por `client`, sem vínculo). Existe
   * para o front linkar direto ao relatório analítico daquela linha, sem
   * precisar buscar de novo pelo nome.
   */
  id: number | null;
  /** Nome do cliente ou do contato, conforme `agrupar_por`. "Sem cliente" quando agrupado por cliente e sem vínculo. */
  nome: string;
  total: number;
  finalizados: number;
  em_aberto: number;
  duracao_total_segundos: number;
  espera_total_segundos: number;
  duracao_media_segundos: number | null;
  espera_media_segundos: number | null;
};

export type ClientReportTotals = {
  total: number;
  finalizados: number;
  em_aberto: number;
  duracao_total_segundos: number;
  espera_total_segundos: number;
  /** Ver o comentário equivalente em `ProductivityTotals`. */
  soma_duracoes_medias_segundos: number;
  soma_esperas_medias_segundos: number;
  duracao_media_segundos: number | null;
  espera_media_segundos: number | null;
};

export type ClientReport = {
  linhas: ClientReportRow[];
  totais: ClientReportTotals;
};

/**
 * Prefixo dos atendimentos inseridos à mão para popular os gráficos em
 * desenvolvimento - 45 das 54 linhas da base de dev, sem atendente e sem
 * `answered_at`, o que distorceria qualquer média.
 *
 * Decisão do usuário: ficam no banco, porque "ajudam ter uma noção de quando
 * tem mais quantidade" nos gráficos, e são excluídos aqui. **Este é o único
 * lugar do código que conhece essa regra** - quando os dados falsos forem
 * apagados, é só esta constante e o `andWhere` abaixo que saem.
 */
const PREFIXO_PROTOCOLO_DE_TESTE = '9999%';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(SupportChats)
    private readonly supportChatsRepository: Repository<SupportChats>,
  ) {}

  /**
   * Os filtros em texto, para o cabeçalho do PDF e da planilha.
   *
   * Resolve os nomes com uma consulta só, e **sempre devolve os cinco**: um
   * filtro ausente vira "Todos" por extenso, nunca some da lista. Omitir o que
   * não foi filtrado deixaria quem recebe o arquivo sem saber se o relatório é
   * da operação inteira ou de um recorte - é a mesma regra do select na tela,
   * onde "Todos" é opção visível.
   */
  async descreveFiltros(
    filtro: ReportFilterDto,
    opcoes: { incluirSituacaoEBusca?: boolean; incluirAgrupamento?: boolean } = {},
  ): Promise<{ rotulo: string; valor: string }[]> {
    const { incluirSituacaoEBusca = true, incluirAgrupamento = false } = opcoes;

    const nome = async (tabela: string, id: number | undefined, coluna = 'name') => {
      if (!id) return 'Todos';

      const [linha] = await this.supportChatsRepository.query(
        `SELECT ${coluna} AS nome FROM ${tabela} WHERE id = $1`,
        [id],
      );

      // O registro pode ter sido removido depois de o relatório ser montado;
      // mostrar o id é melhor do que afirmar "Todos", que seria mentira.
      return linha?.nome ?? `#${id}`;
    };

    /**
     * Mesma ideia de `nome`, para os filtros multiseleção (Setor, Canal,
     * Situação) - uma lista vazia/ausente também vira "Todos"; com itens,
     * cada nome é resolvido e juntado por vírgula.
     */
    const nomes = async (tabela: string, ids: number[] | undefined, coluna = 'name') => {
      if (!ids?.length) return 'Todos';

      const linhas = await Promise.all(ids.map((id) => nome(tabela, id, coluna)));
      return linhas.join(', ');
    };

    const filtros = [{ rotulo: 'Atendente', valor: await nome('users', filtro.user_id) }];

    // Cliente, Situação e Busca são filtros de **conversa individual**; os
    // relatórios agrupados (produtividade, por cliente) não preservam o que
    // essas três linhas de filtro descreveriam.
    if (incluirSituacaoEBusca) {
      filtros.push({ rotulo: 'Cliente', valor: await nome('clients', filtro.client_id, 'nome') });

      // Só aparece quando filtrado - diferente de "Atendente"/"Cliente", que
      // sempre aparecem (mesmo como "Todos"): contato é o filtro central do
      // relatório analítico, sempre presente ali, e um "Todos" nos outros
      // relatórios (que não filtram por contato) seria confuso.
      if (filtro.contact_id) {
        filtros.push({
          rotulo: 'Contato',
          valor: await nome('contacts', filtro.contact_id, "TRIM(CONCAT(name, ' ', COALESCE(last_name, '')))"),
        });
      }

      filtros.push({
        rotulo: 'Situação',
        valor:
          (await nomes('support_chat_status', filtro.support_chat_status_id)) === 'Todos'
            ? 'Todas'
            : await nomes('support_chat_status', filtro.support_chat_status_id),
      });
    }

    filtros.push({ rotulo: 'Setor', valor: await nomes('departments', filtro.department_id) });
    filtros.push({ rotulo: 'Canal', valor: await nomes('channels', filtro.channel_id) });

    if (incluirSituacaoEBusca && filtro.busca?.trim()) {
      filtros.push({ rotulo: 'Busca', valor: filtro.busca.trim() });
    }

    // Só o relatório por cliente usa isto - "Agrupado por" diz se a linha é
    // uma conta ou um número de WhatsApp, e "Sem cliente" só existe no
    // primeiro caso, então o filtro só aparece quando faz sentido.
    if (incluirAgrupamento) {
      const agruparPor = filtro.agrupar_por ?? 'client';
      filtros.push({
        rotulo: 'Agrupado por',
        valor: agruparPor === 'contact' ? 'Contato' : 'Cliente',
      });

      if (agruparPor === 'client') {
        filtros.push({
          rotulo: 'Sem cliente',
          valor: filtro.ignorar_sem_cliente ? 'Ignorados' : 'Incluídos',
        });
      }

      filtros.push({
        rotulo: 'Ordenado por',
        valor: this.descreveOrdenacaoPorCliente(filtro.ordenar_por),
      });
    }

    return filtros;
  }

  /** O rótulo do dropdown de ordenação, para o cabeçalho do PDF/Excel - mesmo texto da tela. */
  private descreveOrdenacaoPorCliente(ordenarPor: ClientReportSortBy | undefined): string {
    const rotulos: Record<ClientReportSortBy, string> = {
      mais_atendimentos: 'Mais atendimentos',
      menos_atendimentos: 'Menos atendimentos',
      mais_finalizados: 'Mais finalizados',
      menos_finalizados: 'Menos finalizados',
      mais_em_aberto: 'Mais em aberto',
      menos_em_aberto: 'Menos em aberto',
      mais_tempo_total: 'Mais tempo total',
      menos_tempo_total: 'Menos tempo total',
      mais_espera_media: 'Maior espera média',
      menos_espera_media: 'Menor espera média',
    };

    return rotulos[ordenarPor ?? 'mais_atendimentos'];
  }

  /** `30/09/2026 a 16/10/2026`, ou o que fizer sentido com meio período. */
  descrevePeriodo(filtro: ReportFilterDto): string {
    const formata = (data: Date) =>
      new Date(data).toLocaleDateString('pt-BR', { timeZone: FUSO_EXIBICAO });

    if (filtro.de && filtro.ate) return `${formata(filtro.de)} a ${formata(filtro.ate)}`;
    if (filtro.de) return `a partir de ${formata(filtro.de)}`;
    if (filtro.ate) return `até ${formata(filtro.ate)}`;

    return 'todo o período';
  }

  async atendimentos(filtro: ReportFilterDto): Promise<AttendanceReport> {
    const linhas = await this.consultaAtendimentos(filtro).getRawMany<AttendanceRow>();

    return {
      // O driver devolve numérico como string; a conta e a formatação
      // acontecem com número, aqui e não em cada consumidor (tela, Excel, PDF).
      linhas: linhas.map((linha) => ({
        ...linha,
        duracao_segundos: this.paraNumero(linha.duracao_segundos),
        espera_segundos: this.paraNumero(linha.espera_segundos),
      })),
      totais: this.totaliza(linhas),
    };
  }

  /**
   * A busca do autocomplete do relatório analítico - clientes e contatos
   * juntos, cada um com `tipo` para o front diferenciar na lista.
   *
   * Só `id`/`nome`/`tipo`: esta rota não exige `client:view`/`contact:view`,
   * então não devolve cadastro completo (CNPJ, telefone) - ver
   * `ClientSearchDto`.
   *
   * Direto em `query()`, sem `createQueryBuilder`: é uma busca textual simples
   * nas duas tabelas, e um `UNION ALL` cru é mais direto que compor dois
   * query builders e juntar os resultados em memória.
   */
  async buscarClienteOuContato(
    termo: string,
  ): Promise<{ id: number; nome: string; tipo: 'client' | 'contact' }[]> {
    const linhas = await this.supportChatsRepository.query(
      `(SELECT cl.id AS id, cl.nome AS nome, 'client' AS tipo
          FROM clients cl
          WHERE cl.nome ILIKE $1
          ORDER BY cl.nome
          LIMIT 10)
        UNION ALL
        (SELECT ct.id AS id, TRIM(CONCAT(ct.name, ' ', COALESCE(ct.last_name, ''))) AS nome, 'contact' AS tipo
          FROM contacts ct
          WHERE TRIM(CONCAT(ct.name, ' ', COALESCE(ct.last_name, ''))) ILIKE $1
          ORDER BY nome
          LIMIT 10)`,
      [`%${termo.trim()}%`],
    );

    return linhas;
  }

  /**
   * Resolve o nome de um cliente/contato pelo `id` - usado quando o
   * analítico abre já filtrado (ex.: vindo de uma linha do relatório por
   * cliente, via query string), para a busca mostrar o nome escolhido em vez
   * de nascer em branco com só o filtro aplicado por trás.
   */
  async resolverClienteOuContato(
    id: number,
    tipo: ClientReportGroupBy,
  ): Promise<{ id: number; nome: string; tipo: ClientReportGroupBy } | null> {
    if (tipo === 'contact') {
      const [linha] = await this.supportChatsRepository.query(
        `SELECT TRIM(CONCAT(name, ' ', COALESCE(last_name, ''))) AS nome FROM contacts WHERE id = $1`,
        [id],
      );
      return linha ? { id, nome: linha.nome, tipo } : null;
    }

    const [linha] = await this.supportChatsRepository.query(
      `SELECT nome FROM clients WHERE id = $1`,
      [id],
    );
    return linha ? { id, nome: linha.nome, tipo } : null;
  }

  /**
   * Produtividade por atendente: uma linha por quem assumiu ao menos um
   * atendimento no período filtrado.
   *
   * Só atendentes com atendimento no recorte aparecem - listar todo mundo
   * zerado misturaria "não trabalhou neste período" com "não existe mais
   * como atendente", e a segunda informação não é deste relatório.
   */
  async produtividade(filtro: ReportFilterDto): Promise<ProductivityReport> {
    const linhasCru = await this.consultaProdutividade(filtro).getRawMany<{
      atendente: string;
      total: string;
      finalizados: string;
      mensagens_enviadas: string;
      duracao_total_segundos: string | null;
      espera_total_segundos: string | null;
      duracao_media_segundos: string | null;
      espera_media_segundos: string | null;
    }>();

    const linhas: ProductivityRow[] = linhasCru.map((linha) => {
      const total = Number(linha.total);
      const finalizados = Number(linha.finalizados);

      return {
        atendente: linha.atendente,
        total,
        finalizados,
        em_aberto: total - finalizados,
        mensagens_enviadas: Number(linha.mensagens_enviadas),
        duracao_total_segundos: this.paraNumero(linha.duracao_total_segundos) ?? 0,
        espera_total_segundos: this.paraNumero(linha.espera_total_segundos) ?? 0,
        duracao_media_segundos: this.paraNumero(linha.duracao_media_segundos),
        espera_media_segundos: this.paraNumero(linha.espera_media_segundos),
      };
    });

    return { linhas, totais: this.totalizaProdutividade(linhas) };
  }

  /**
   * Uma linha por atendente, com as médias calculadas **no banco** - ao
   * contrário do relatório de atendimentos, aqui não dá para agregar em
   * memória: a unidade já é o grupo, e reconstruir isso em JavaScript seria
   * reescrever o `GROUP BY` do lado de fora.
   */
  private consultaProdutividade(filtro: ReportFilterDto): SelectQueryBuilder<SupportChats> {
    const query = this.supportChatsRepository
      .createQueryBuilder('sc')
      .innerJoin('users', 'u', 'u.id = sc.user_id')
      .innerJoin('support_chat_status', 'st', 'st.id = sc.support_chat_status_id')
      .leftJoin('departments', 'dp', 'dp.id = sc.department_id')
      .leftJoin('channels', 'ch', 'ch.id = sc.channel_id')
      .leftJoin('contacts', 'ct', 'ct.id = sc.contact_id')
      // `cl` não entra em nenhuma coluna deste relatório - está aqui só para
      // `aplicaFiltros` poder usar `cl.nome` na busca, que é compartilhada
      // entre todas as consultas deste service.
      .leftJoin('clients', 'cl', 'cl.id = ct.client_id')
      .select("TRIM(CONCAT(u.name, ' ', COALESCE(u.last_name, '')))", 'atendente')
      .addSelect('COUNT(*)', 'total')
      .addSelect('COUNT(*) FILTER (WHERE st.is_final)', 'finalizados')
      // Mensagens digitadas pelo atendente nos atendimentos da linha:
      // `from_me` e não automática. Subconsulta correlacionada, e não join -
      // um `leftJoin` nas mensagens multiplicaria a linha do atendimento por
      // mensagem, inflando a contagem de atendimentos no mesmo `GROUP BY`.
      .addSelect(
        `COALESCE(SUM((SELECT COUNT(*) FROM support_chat_messages m
            WHERE m.support_chat_id = sc.id AND m.from_me = true AND m.is_automatic = false)), 0)`,
        'mensagens_enviadas',
      )
      // Soma e média usam a mesma fórmula do relatório de atendimentos:
      // `GREATEST(..., 0)` porque a pausa é gravada por fora da duração, e um
      // atendimento curto com pausa longa daria negativo sem o teto em zero.
      //
      // Sem `answered_at` não existe duração de atendimento - ninguém
      // assumiu, então não há o que medir do início da resposta ao fim; só
      // "espera" (abaixo) faz sentido para essa linha. Contá-la como
      // `finished_at - created_at` inflava a duração com o tempo que a
      // conversa passou largada, e entrava na média como se fosse
      // atendimento de verdade.
      .addSelect(
        `COALESCE(SUM(CASE WHEN sc.finished_at IS NULL OR sc.answered_at IS NULL THEN NULL ELSE
             GREATEST(
               EXTRACT(EPOCH FROM (sc.finished_at - sc.answered_at)) - sc.paused_total_seconds,
               0
             )
           END), 0)`,
        'duracao_total_segundos',
      )
      .addSelect(
        `AVG(CASE WHEN sc.finished_at IS NULL OR sc.answered_at IS NULL THEN NULL ELSE
             GREATEST(
               EXTRACT(EPOCH FROM (sc.finished_at - sc.answered_at)) - sc.paused_total_seconds,
               0
             )
           END)`,
        'duracao_media_segundos',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN sc.answered_at IS NULL THEN NULL ELSE
             EXTRACT(EPOCH FROM (sc.answered_at - sc.created_at))
           END), 0)`,
        'espera_total_segundos',
      )
      .addSelect(
        `AVG(CASE WHEN sc.answered_at IS NULL THEN NULL ELSE
             EXTRACT(EPOCH FROM (sc.answered_at - sc.created_at))
           END)`,
        'espera_media_segundos',
      )
      .where('sc.protocol NOT LIKE :testes', { testes: PREFIXO_PROTOCOLO_DE_TESTE })
      .andWhere('sc.user_id IS NOT NULL')
      .groupBy('u.id')
      .addGroupBy('u.name')
      .addGroupBy('u.last_name');

    this.aplicaPeriodo(query, filtro);
    this.aplicaFiltros(query, filtro);

    // Mais produtivo primeiro: é a pergunta que o relatório existe para
    // responder.
    return query.orderBy('COUNT(*)', 'DESC');
  }

  /**
   * Os totais do rodapé, sobre as linhas já agregadas por atendente.
   *
   * As médias aqui são a **média das médias** (uma por linha), não a média
   * de todos os atendimentos somados - no rodapé de um relatório agrupado é
   * isso que se espera ver: o retrato típico de um atendente, não o do
   * atendimento típico.
   */
  private totalizaProdutividade(linhas: ProductivityRow[]): ProductivityTotals {
    const finalizados = linhas.reduce((soma, l) => soma + l.finalizados, 0);
    const total = linhas.reduce((soma, l) => soma + l.total, 0);
    const mensagens = linhas.reduce((soma, l) => soma + l.mensagens_enviadas, 0);
    // Soma, e não média: tempo total é aditivo - diferente das médias
    // abaixo, somar as linhas dá exatamente o tempo total do período.
    const duracaoTotal = linhas.reduce((soma, l) => soma + l.duracao_total_segundos, 0);
    const esperaTotal = linhas.reduce((soma, l) => soma + l.espera_total_segundos, 0);

    const duracoes = linhas
      .map((l) => l.duracao_media_segundos)
      .filter((v): v is number => v !== null);

    const esperas = linhas
      .map((l) => l.espera_media_segundos)
      .filter((v): v is number => v !== null);

    // A soma literal da coluna "Duração média"/"Espera média" - diferente da
    // soma de todos os atendimentos (`duracaoTotal`/`esperaTotal`): aqui é
    // "some os números que aparecem na coluna", não "some as durações reais".
    const somaDuracoesMedias = this.soma(duracoes);
    const somaEsperasMedias = this.soma(esperas);

    return {
      total,
      finalizados,
      em_aberto: total - finalizados,
      mensagens_enviadas: mensagens,
      duracao_total_segundos: duracaoTotal,
      espera_total_segundos: esperaTotal,
      soma_duracoes_medias_segundos: somaDuracoesMedias,
      soma_esperas_medias_segundos: somaEsperasMedias,
      duracao_media_segundos: this.media(duracoes),
      espera_media_segundos: this.media(esperas),
    };
  }

  /**
   * Relatório por cliente ou por contato - uma linha por quem foi atendido,
   * em vez de quem atendeu.
   *
   * `agrupar_por: 'client'` (padrão) agrupa pela conta, que pode ter vários
   * contatos; `'contact'` agrupa pelo número de WhatsApp individual. Sem
   * cliente vinculado ("Sem cliente") só existe no primeiro modo - contato é
   * sempre o próprio atendimento, nunca nulo.
   */
  async porCliente(filtro: ReportFilterDto): Promise<ClientReport> {
    const agruparPor: ClientReportGroupBy = filtro.agrupar_por ?? 'client';

    const linhasCru = await this.consultaPorCliente(filtro, agruparPor).getRawMany<{
      id: number | null;
      nome: string | null;
      total: string;
      finalizados: string;
      duracao_total_segundos: string | null;
      espera_total_segundos: string | null;
      duracao_media_segundos: string | null;
      espera_media_segundos: string | null;
    }>();

    const linhas: ClientReportRow[] = linhasCru.map((linha) => {
      const total = Number(linha.total);
      const finalizados = Number(linha.finalizados);

      return {
        id: linha.id,
        nome: linha.nome ?? 'Sem cliente',
        total,
        finalizados,
        em_aberto: total - finalizados,
        duracao_total_segundos: this.paraNumero(linha.duracao_total_segundos) ?? 0,
        espera_total_segundos: this.paraNumero(linha.espera_total_segundos) ?? 0,
        duracao_media_segundos: this.paraNumero(linha.duracao_media_segundos),
        espera_media_segundos: this.paraNumero(linha.espera_media_segundos),
      };
    });

    return { linhas, totais: this.totalizaPorCliente(linhas) };
  }

  /**
   * Uma linha por cliente/contato, mesmo molde de `consultaProdutividade` -
   * ver os comentários lá para a fórmula de duração/espera, idêntica aqui.
   */
  private consultaPorCliente(
    filtro: ReportFilterDto,
    agruparPor: ClientReportGroupBy,
  ): SelectQueryBuilder<SupportChats> {
    const query = this.supportChatsRepository
      .createQueryBuilder('sc')
      .innerJoin('contacts', 'ct', 'ct.id = sc.contact_id')
      .leftJoin('clients', 'cl', 'cl.id = ct.client_id')
      .innerJoin('support_chat_status', 'st', 'st.id = sc.support_chat_status_id')
      // `.select()`, não `.addSelect()`: sem isto o TypeORM mantém o SELECT
      // padrão da entidade (`sc.*`) junto dos agregados, e o Postgres recusa
      // com "column must appear in GROUP BY" (erro 42803) - foi exatamente o
      // bug que derrubou a rota na primeira versão.
      .select('COUNT(*)', 'total')
      .addSelect('COUNT(*) FILTER (WHERE st.is_final)', 'finalizados')
      // Sem `answered_at` não existe duração de atendimento - ver o
      // comentário equivalente em `consultaProdutividade`.
      .addSelect(
        `COALESCE(SUM(CASE WHEN sc.finished_at IS NULL OR sc.answered_at IS NULL THEN NULL ELSE
             GREATEST(
               EXTRACT(EPOCH FROM (sc.finished_at - sc.answered_at)) - sc.paused_total_seconds,
               0
             )
           END), 0)`,
        'duracao_total_segundos',
      )
      .addSelect(
        `AVG(CASE WHEN sc.finished_at IS NULL OR sc.answered_at IS NULL THEN NULL ELSE
             GREATEST(
               EXTRACT(EPOCH FROM (sc.finished_at - sc.answered_at)) - sc.paused_total_seconds,
               0
             )
           END)`,
        'duracao_media_segundos',
      )
      // Nunca assumido e já finalizado: a "espera" vai até o fechamento, não
      // até um "assumir" que nunca aconteceu - só fica nula se a conversa
      // ainda está aberta, porque aí ninguém sabe quanto vai esperar ainda.
      .addSelect(
        `COALESCE(SUM(CASE WHEN sc.answered_at IS NULL AND sc.finished_at IS NULL THEN NULL ELSE
             EXTRACT(EPOCH FROM (COALESCE(sc.answered_at, sc.finished_at) - sc.created_at))
           END), 0)`,
        'espera_total_segundos',
      )
      .addSelect(
        `AVG(CASE WHEN sc.answered_at IS NULL AND sc.finished_at IS NULL THEN NULL ELSE
             EXTRACT(EPOCH FROM (COALESCE(sc.answered_at, sc.finished_at) - sc.created_at))
           END)`,
        'espera_media_segundos',
      )
      .where('sc.protocol NOT LIKE :testes', { testes: PREFIXO_PROTOCOLO_DE_TESTE });

    if (agruparPor === 'contact') {
      // Por contato: o nome já existe sempre (é o próprio atendimento), e o
      // agrupamento é o `id` do contato - não há "sem contato" possível.
      query
        .addSelect('ct.id', 'id')
        .addSelect("TRIM(CONCAT(ct.name, ' ', COALESCE(ct.last_name, '')))", 'nome')
        .groupBy('ct.id')
        .addGroupBy('ct.name')
        .addGroupBy('ct.last_name');
    } else {
      // Por cliente: `cl.nome` nulo vira "Sem cliente" em `porCliente` - o
      // `groupBy` em `cl.id` (e não só o nome) evita juntar dois clientes
      // diferentes que por acaso tenham o mesmo nome cadastrado.
      query
        .addSelect('cl.id', 'id')
        .addSelect('cl.nome', 'nome')
        .groupBy('cl.id')
        .addGroupBy('cl.nome');

      if (filtro.ignorar_sem_cliente) {
        query.andWhere('cl.id IS NOT NULL');
      }
    }

    this.aplicaPeriodo(query, filtro);
    this.aplicaFiltros(query, filtro);

    return this.aplicaOrdenacaoPorCliente(query, filtro.ordenar_por);
  }

  /**
   * O dropdown de ordenação do relatório por cliente - vale igual na tela e
   * nas duas exportações, já que todas chamam `porCliente()`.
   *
   * "Em aberto" não tem coluna própria na consulta (é `total - finalizados`
   * em `porCliente()`), mas a mesma conta funciona direto no `ORDER BY`: o
   * Postgres aceita repetir a expressão agregada.
   */
  private aplicaOrdenacaoPorCliente(
    query: SelectQueryBuilder<SupportChats>,
    ordenarPor: ClientReportSortBy | undefined,
  ): SelectQueryBuilder<SupportChats> {
    const EM_ABERTO = 'COUNT(*) FILTER (WHERE NOT st.is_final)';

    const mapa: Record<ClientReportSortBy, [string, 'ASC' | 'DESC']> = {
      mais_atendimentos: ['COUNT(*)', 'DESC'],
      menos_atendimentos: ['COUNT(*)', 'ASC'],
      mais_finalizados: ['COUNT(*) FILTER (WHERE st.is_final)', 'DESC'],
      menos_finalizados: ['COUNT(*) FILTER (WHERE st.is_final)', 'ASC'],
      mais_em_aberto: [EM_ABERTO, 'DESC'],
      menos_em_aberto: [EM_ABERTO, 'ASC'],
      mais_tempo_total: ['duracao_total_segundos', 'DESC'],
      menos_tempo_total: ['duracao_total_segundos', 'ASC'],
      mais_espera_media: ['espera_media_segundos', 'DESC'],
      menos_espera_media: ['espera_media_segundos', 'ASC'],
    };

    // "Mais atendimentos" é a pergunta que o relatório existe para
    // responder - mesmo padrão de antes de este filtro existir.
    const [expressao, direcao] = mapa[ordenarPor ?? 'mais_atendimentos'];

    return query.orderBy(expressao, direcao);
  }

  /** Mesmo raciocínio de `totalizaProdutividade` - ver os comentários lá. */
  private totalizaPorCliente(linhas: ClientReportRow[]): ClientReportTotals {
    const finalizados = linhas.reduce((soma, l) => soma + l.finalizados, 0);
    const total = linhas.reduce((soma, l) => soma + l.total, 0);
    const duracaoTotal = linhas.reduce((soma, l) => soma + l.duracao_total_segundos, 0);
    const esperaTotal = linhas.reduce((soma, l) => soma + l.espera_total_segundos, 0);

    const duracoes = linhas
      .map((l) => l.duracao_media_segundos)
      .filter((v): v is number => v !== null);

    const esperas = linhas
      .map((l) => l.espera_media_segundos)
      .filter((v): v is number => v !== null);

    return {
      total,
      finalizados,
      em_aberto: total - finalizados,
      duracao_total_segundos: duracaoTotal,
      espera_total_segundos: esperaTotal,
      soma_duracoes_medias_segundos: this.soma(duracoes),
      soma_esperas_medias_segundos: this.soma(esperas),
      duracao_media_segundos: this.media(duracoes),
      espera_media_segundos: this.media(esperas),
    };
  }

  /**
   * A consulta, montada em um lugar só para a listagem e as exportações
   * verem exatamente as mesmas linhas - um relatório que diverge do arquivo
   * que ele gera é pior do que não ter relatório.
   */
  private consultaAtendimentos(filtro: ReportFilterDto): SelectQueryBuilder<SupportChats> {
    const query = this.supportChatsRepository
      .createQueryBuilder('sc')
      // `leftJoin` em todas: contato sem cliente, atendimento sem dono e
      // atendimento sem setor são todos casos normais - com `innerJoin` o
      // relatório esconderia justamente as linhas que importam investigar.
      .leftJoin('contacts', 'ct', 'ct.id = sc.contact_id')
      .leftJoin('clients', 'cl', 'cl.id = ct.client_id')
      .leftJoin('users', 'u', 'u.id = sc.user_id')
      .leftJoin('departments', 'dp', 'dp.id = sc.department_id')
      .leftJoin('channels', 'ch', 'ch.id = sc.channel_id')
      .innerJoin('support_chat_status', 'st', 'st.id = sc.support_chat_status_id')
      .select('sc.id::text', 'id')
      .addSelect('sc.protocol', 'protocolo')
      .addSelect("TRIM(CONCAT(ct.name, ' ', COALESCE(ct.last_name, '')))", 'contato')
      .addSelect('ct.phone', 'telefone')
      .addSelect('cl.nome', 'cliente')
      .addSelect("TRIM(CONCAT(u.name, ' ', COALESCE(u.last_name, '')))", 'atendente')
      .addSelect('dp.name', 'setor')
      .addSelect('ch.name', 'canal')
      .addSelect('sc.created_at', 'aberto_em')
      .addSelect('sc.answered_at', 'atendido_em')
      .addSelect('sc.finished_at', 'finalizado_em')
      // A mesma fórmula do dashboard: `GREATEST(..., 0)` porque a pausa é
      // gravada por fora da duração, e um atendimento curto com pausa longa
      // daria negativo.
      //
      // Sem `answered_at` não existe duração de atendimento - ninguém
      // assumiu, e `finished_at - created_at` mediria o tempo que a conversa
      // passou largada até fechar por inatividade, não tempo atendido. Esse
      // caso já tem "espera" (abaixo) para contar o que de fato aconteceu.
      .addSelect(
        `CASE WHEN sc.finished_at IS NULL OR sc.answered_at IS NULL THEN NULL ELSE
           GREATEST(
             EXTRACT(EPOCH FROM (sc.finished_at - sc.answered_at)) - sc.paused_total_seconds,
             0
           )
         END`,
        'duracao_segundos',
      )
      // Nunca assumido e já finalizado: a "espera" vai até o fechamento, não
      // até um "assumir" que nunca aconteceu - só fica nula se a conversa
      // ainda está aberta, porque aí ninguém sabe quanto vai esperar ainda.
      .addSelect(
        `CASE WHEN sc.answered_at IS NULL AND sc.finished_at IS NULL THEN NULL ELSE
           EXTRACT(EPOCH FROM (COALESCE(sc.answered_at, sc.finished_at) - sc.created_at))
         END`,
        'espera_segundos',
      )
      .addSelect('st.name', 'situacao')
      .addSelect('st.is_final', 'is_final')
      .where('sc.protocol NOT LIKE :testes', { testes: PREFIXO_PROTOCOLO_DE_TESTE });

    this.aplicaPeriodo(query, filtro);
    this.aplicaFiltros(query, filtro);

    return this.aplicaOrdenacaoDeAtendimentos(query, filtro.ordenar_atendimentos_por);
  }

  /**
   * A ordenação do relatório de Atendimentos/tela de Histórico.
   *
   * Ausente vira "mais recentes" - mesmo padrão de sempre, antes deste filtro
   * existir, então não muda quem não escolhe nada. As expressões usam os
   * mesmos aliases desta consulta (`sc.created_at`, e os `CASE` de duração e
   * espera escritos de novo porque o Postgres não aceita o alias da coluna no
   * `ORDER BY` de uma consulta sem `GROUP BY`).
   */
  private aplicaOrdenacaoDeAtendimentos(
    query: SelectQueryBuilder<SupportChats>,
    ordenarPor: AttendanceSortBy | undefined,
  ): SelectQueryBuilder<SupportChats> {
    // Mesma ressalva das demais consultas: sem `answered_at` não há duração
    // de atendimento, só espera - ver `consultaAtendimentos`.
    const DURACAO = `CASE WHEN sc.finished_at IS NULL OR sc.answered_at IS NULL THEN NULL ELSE
         GREATEST(EXTRACT(EPOCH FROM (sc.finished_at - sc.answered_at)) - sc.paused_total_seconds, 0)
       END`;
    const ESPERA = `CASE WHEN sc.answered_at IS NULL AND sc.finished_at IS NULL THEN NULL ELSE
         EXTRACT(EPOCH FROM (COALESCE(sc.answered_at, sc.finished_at) - sc.created_at))
       END`;

    const mapa: Record<AttendanceSortBy, [string, 'ASC' | 'DESC']> = {
      mais_recentes: ['sc.created_at', 'DESC'],
      mais_antigos: ['sc.created_at', 'ASC'],
      maior_duracao: [DURACAO, 'DESC'],
      menor_duracao: [DURACAO, 'ASC'],
      maior_espera: [ESPERA, 'DESC'],
      menor_espera: [ESPERA, 'ASC'],
    };

    const ordenacaoPorData = !ordenarPor || ordenarPor === 'mais_recentes' || ordenarPor === 'mais_antigos';
    const [expressao, direcao] = mapa[ordenarPor ?? 'mais_recentes'];

    // `NULLS LAST` nas durações/esperas: atendimento em aberto não tem
    // duração nem espera ainda, e sem isto o Postgres os colocaria primeiro
    // em "maior" (NULL conta como maior que qualquer número por padrão).
    return query.orderBy(expressao, direcao, ordenacaoPorData ? undefined : 'NULLS LAST');
  }

  /**
   * O recorte de datas, pela **abertura** do atendimento.
   *
   * As datas chegam como dia (`2026-10-16`), que o `@Type(() => Date)`
   * transforma em meia-noite **UTC**. Comparar isso direto com `created_at`
   * jogaria fora as três primeiras horas do dia em Brasília - por isso a
   * comparação acontece sobre a data já convertida para o fuso de exibição,
   * o mesmo idioma do dashboard.
   */
  /**
   * ⚠️ `:de`/`:ate` sempre passam por `::timestamptz` antes de `::date` -
   * nunca cast direto. O container roda com `TZ=America/Sao_Paulo` (ver
   * `Dockerfile`), e o driver `pg` serializa um `Date` do Node como string
   * **com o offset local** (`2026-10-19T21:00:00.000-03:00` para a meia-noite
   * UTC do dia 20) - é assim que `node-postgres` sempre mandou parâmetros de
   * data, timezone do processo ou não. Um cast direto `string::date` pega a
   * data escrita *antes* do offset, sem reconverter para UTC: aquele exemplo
   * virava `2026-10-19`, um dia a menos, e todo atendimento do próprio dia
   * sumia de "últimos 7 dias" até o dia seguinte. Passar por `::timestamptz`
   * primeiro normaliza o instante antes do truncamento, e `::date` depois já
   * opera num timestamp correto. Comprovado reproduzindo com `pg.Client` puro
   * (fora do TypeORM) - o bug está na combinação driver+fuso do container,
   * não na query em si rodada via `psql`.
   */
  private aplicaPeriodo(query: SelectQueryBuilder<SupportChats>, filtro: ReportFilterDto): void {
    if (filtro.de) {
      query.andWhere(`(sc.created_at AT TIME ZONE :fuso)::date >= :de::timestamptz::date`, {
        fuso: FUSO_EXIBICAO,
        de: filtro.de,
      });
    }

    // `<=` sobre a data, não sobre o instante: informar 16/10 inclui o dia 16
    // inteiro, que é o que quem preenche "até" espera. Com comparação por
    // instante, tudo depois de 00:00 do dia 16 ficaria de fora.
    if (filtro.ate) {
      query.andWhere(`(sc.created_at AT TIME ZONE :fuso)::date <= :ate::timestamptz::date`, {
        fuso: FUSO_EXIBICAO,
        ate: filtro.ate,
      });
    }
  }

  private aplicaFiltros(query: SelectQueryBuilder<SupportChats>, filtro: ReportFilterDto): void {
    if (filtro.user_id) {
      query.andWhere('sc.user_id = :userId', { userId: filtro.user_id });
    }

    // `IN`, não `=`: os três suportam multiseleção (hoje só usada no
    // relatório de Atendimentos) - um array de um elemento só se comporta
    // como o `=` de antes.
    if (filtro.department_id?.length) {
      query.andWhere('sc.department_id IN (:...departmentIds)', {
        departmentIds: filtro.department_id,
      });
    }

    if (filtro.channel_id?.length) {
      query.andWhere('sc.channel_id IN (:...channelIds)', { channelIds: filtro.channel_id });
    }

    if (filtro.client_id) {
      query.andWhere('ct.client_id = :clientId', { clientId: filtro.client_id });
    }

    if (filtro.contact_id) {
      query.andWhere('sc.contact_id = :contactId', { contactId: filtro.contact_id });
    }

    if (filtro.support_chat_status_id?.length) {
      query.andWhere('sc.support_chat_status_id IN (:...statusIds)', {
        statusIds: filtro.support_chat_status_id,
      });
    }

    if (filtro.busca?.trim()) {
      // `ct.name`, não o nome completo (`TRIM(CONCAT(...))`): ILIKE sobre uma
      // expressão calculada exigiria repeti-la aqui, e buscar só pelo
      // primeiro nome já cobre a maioria dos casos de uso real - last_name
      // raramente é preenchido pelo pushName do WhatsApp.
      query.andWhere('(sc.protocol ILIKE :busca OR ct.name ILIKE :busca OR cl.nome ILIKE :busca)', {
        busca: `%${filtro.busca.trim()}%`,
      });
    }
  }

  /**
   * Os totais, sobre as linhas já filtradas.
   *
   * Em memória, e não numa segunda consulta com `COUNT`/`AVG`: o relatório é
   * recortado por período, e repetir a consulta inteira só para agregar
   * custaria o dobro para somar o que já está na mão.
   */
  private totaliza(linhas: AttendanceRow[]): AttendanceTotals {
    const finalizados = linhas.filter((l) => (l as unknown as { is_final: boolean }).is_final);

    const duracoes = linhas
      .map((l) => this.paraNumero(l.duracao_segundos))
      .filter((v): v is number => v !== null);

    // Só o que foi de fato atendido entra na média de espera: contar o que
    // ninguém assumiu como espera zero faria o indicador melhorar justamente
    // quando a fila piora.
    const esperas = linhas
      .map((l) => this.paraNumero(l.espera_segundos))
      .filter((v): v is number => v !== null);

    return {
      total: linhas.length,
      finalizados: finalizados.length,
      em_aberto: linhas.length - finalizados.length,
      duracao_total_segundos: this.soma(duracoes),
      espera_total_segundos: this.soma(esperas),
      duracao_media_segundos: this.media(duracoes),
      espera_media_segundos: this.media(esperas),
    };
  }

  private media(valores: number[]): number | null {
    if (!valores.length) return null;
    return Math.round(this.soma(valores) / valores.length);
  }

  private soma(valores: number[]): number {
    return valores.reduce((soma, v) => soma + v, 0);
  }

  /** O driver devolve `numeric`/`EXTRACT` como string; nulo continua nulo. */
  private paraNumero(valor: unknown): number | null {
    if (valor === null || valor === undefined) return null;
    const numero = Number(valor);
    return Number.isFinite(numero) ? Math.round(numero) : null;
  }
}
