import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';

import { ChannelStatus, SupportChatStatusId } from '@/@types';
import { Channels } from '@/channels/entities/channels.entity';
import { Contacts } from '@/contacts/entities/contacts.entity';
import { PresencaService } from '@/presenca/presenca.service';
import { SupportChats } from '@/support-chats/entities/support-chats.entity';
import { FUSO_EXIBICAO } from '@/core/fuso-exibicao';
import { PeriodoMovimento } from './dto/movimento-por-semana.dto';

export type PontoDiaSemana = { diaSemana: number; total: number };

/** Os números do Início, no portal e no app mobile. */
export type ResumoDashboard = {
  contatos: number;
  finalizados: number;
  emAtendimento: number;
  /** Média em segundos; `null` quando ainda não há atendimento finalizado. */
  tempoMedioSegundos: number | null;
  /** Esperando um atendente humano. A fila do chatbot (`EM_FILA`) não entra. */
  aguardando: number;
  /** Usuários com o portal ou o app aberto agora. */
  atendentesOnline: number;
  /**
   * Canais com WhatsApp conectado. Vem aqui, e não de `GET /channels`, porque
   * aquela rota exige `channel:view`, que o atendente pode não ter.
   */
  canaisConectados: { id: number; nome: string }[];
};

/** Um dia da série do gráfico. */
export type PontoSerie = {
  /** `YYYY-MM-DD`, já no fuso de exibição. */
  dia: string;
  total: number;
};



/** Uma hora do dia, na distribuição de movimento. */
export type PontoHora = {
  /** 0 a 23. */
  hora: number;
  total: number;
};

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Contacts)
    private readonly contactsRepository: Repository<Contacts>,
    @InjectRepository(SupportChats)
    private readonly supportChatsRepository: Repository<SupportChats>,
    @InjectRepository(Channels)
    private readonly channelsRepository: Repository<Channels>,
    private readonly presencaService: PresencaService,
  ) {}

  /** Quantidade de aberturas, como no gráfico por hora; domingo é 0.
   * Semana começa no domingo. Seis meses inclui o atual e os cinco anteriores.
   *
   * Semana passada e último mês são períodos fechados: vão do início do
   * período anterior até o início do atual, exclusive. Os demais seguem até
   * agora; o fim deles é `infinity` porque nada é criado no futuro, o que
   * equivale ao antigo `<= agora` com um filtro só para todos. */
  async movimentoPorSemana(periodo: PeriodoMovimento = 'esta_semana'): Promise<PontoDiaSemana[]> {
    return this.supportChatsRepository.query(`
      WITH referencia AS (
        SELECT NOW() AS agora, NOW() AT TIME ZONE $1 AS local
      ), limites_locais AS (
        SELECT (CASE $2
          WHEN 'esta_semana' THEN date_trunc('day', local) - EXTRACT(DOW FROM local)::int * INTERVAL '1 day'
          WHEN 'semana_passada' THEN date_trunc('day', local) - EXTRACT(DOW FROM local)::int * INTERVAL '1 day' - INTERVAL '7 days'
          WHEN 'este_mes' THEN date_trunc('month', local)
          WHEN 'ultimo_mes' THEN date_trunc('month', local) - INTERVAL '1 month'
          WHEN 'ultimos_seis_meses' THEN date_trunc('month', local) - INTERVAL '5 months'
        END) AT TIME ZONE $1 AS inicio,
        (CASE $2
          WHEN 'semana_passada' THEN date_trunc('day', local) - EXTRACT(DOW FROM local)::int * INTERVAL '1 day'
          WHEN 'ultimo_mes' THEN date_trunc('month', local)
          ELSE NULL
        END) AT TIME ZONE $1 AS fim_fechado FROM referencia
      ), limites AS (
        SELECT inicio, COALESCE(fim_fechado, 'infinity'::timestamptz) AS fim FROM limites_locais
      ), contagens AS (
        SELECT EXTRACT(DOW FROM (sc.created_at AT TIME ZONE $1))::int AS dia, COUNT(*)::int AS total
        FROM support_chats sc CROSS JOIN limites l
        WHERE sc.created_at >= l.inicio AND sc.created_at < l.fim
        GROUP BY dia
      )
      SELECT d.dia::int AS "diaSemana", COALESCE(c.total, 0)::int AS total
      FROM generate_series(0, 6) AS d(dia)
      LEFT JOIN contagens c ON c.dia = d.dia ORDER BY d.dia
    `, [FUSO_EXIBICAO, periodo]);
  }

  /**
   * Os números do Início de uma vez.
   *
   * Em paralelo porque são consultas independentes: em série, a home esperaria
   * a soma dos quatro tempos.
   */
  async resumo(): Promise<ResumoDashboard> {
    const [contatos, finalizados, emAtendimento, tempoMedioSegundos, aguardando, canaisConectados] =
      await Promise.all([
        this.contarContatos(),
        this.contarFinalizados(),
        this.contarEmAtendimento(),
        this.tempoMedioDeAtendimento(),
        this.contarAguardando(),
        this.listarCanaisConectados(),
      ]);

    return {
      contatos,
      finalizados,
      emAtendimento,
      tempoMedioSegundos,
      aguardando,
      atendentesOnline: this.presencaService.online().length,
      canaisConectados,
    };
  }

  private contarAguardando(): Promise<number> {
    return this.supportChatsRepository.count({
      where: { support_chat_status_id: SupportChatStatusId.AGUARDANDO },
    });
  }

  private async listarCanaisConectados(): Promise<{ id: number; nome: string }[]> {
    const canais = await this.channelsRepository.find({
      select: { id: true, name: true },
      where: { channel_status_id: ChannelStatus.CONNECTED, deleted_at: IsNull() },
      order: { name: 'ASC' },
    });
    return canais.map((canal) => ({ id: canal.id, nome: canal.name }));
  }

  /** `status: 1` é o contato ativo - o inativo some das listagens. */
  private contarContatos(): Promise<number> {
    return this.contactsRepository.count({ where: { status: 1 } });
  }

  private contarFinalizados(): Promise<number> {
    return this.supportChatsRepository
      .createQueryBuilder('chat')
      .innerJoin('support_chat_status', 'st', 'st.id = chat.support_chat_status_id')
      // Pela flag, não por uma lista de ids: um status final novo entra na
      // conta sozinho, sem precisar lembrar de alterar o dashboard.
      .where('st.is_final = true')
      .getCount();
  }

  /**
   * Conversas abertas agora.
   *
   * A pausada entra: ela continua `EM_ANDAMENTO` e com dono - só está com o
   * cronômetro parado (ver `AddPausaToSupportChats`).
   */
  private contarEmAtendimento(): Promise<number> {
    return this.supportChatsRepository.count({
      where: { support_chat_status_id: SupportChatStatusId.EM_ANDAMENTO },
    });
  }

  /**
   * Média da duração dos atendimentos finalizados, em segundos.
   *
   * Desconta `paused_total_seconds`: o tempo pausado não é atendimento, e
   * somá-lo inflaria a média de quem usa a pausa. O `GREATEST(..., 0)` existe
   * porque a pausa é gravada por fora da duração - um atendimento curto com
   * pausa longa daria negativo.
   *
   * Só entram os que têm `finished_at` **e** `answered_at`: sem o segundo,
   * ninguém assumiu a conversa, e `finished_at - created_at` mediria o tempo
   * que ela ficou largada até fechar por inatividade, não tempo atendido -
   * mesma ressalva de `reports.service.ts`.
   */
  private async tempoMedioDeAtendimento(): Promise<number | null> {
    const { media } = await this.supportChatsRepository
      .createQueryBuilder('chat')
      .select(
        'AVG(GREATEST(EXTRACT(EPOCH FROM (chat.finished_at - chat.answered_at)) - chat.paused_total_seconds, 0))',
        'media',
      )
      .innerJoin('support_chat_status', 'st', 'st.id = chat.support_chat_status_id')
      .where('st.is_final = true')
      .andWhere('chat.finished_at IS NOT NULL')
      .andWhere('chat.answered_at IS NOT NULL')
      .getRawOne<{ media: string | null }>();

    return media === null ? null : Math.round(Number(media));
  }

  /**
   * Finalizados por dia nos últimos 7 dias, incluindo hoje.
   *
   * O `generate_series` com `LEFT JOIN` é o que garante os **sete** pontos: um
   * `GROUP BY` sozinho omitiria os dias sem atendimento, e a linha do gráfico
   * ligaria terça a sexta como se quarta e quinta não existissem.
   */
  async serieFinalizados(): Promise<PontoSerie[]> {
    const linhas = await this.supportChatsRepository.query(
      `
      SELECT to_char(dia, 'YYYY-MM-DD') AS dia, COALESCE(c.total, 0)::int AS total
      FROM generate_series(
             (NOW() AT TIME ZONE $1)::date - INTERVAL '6 days',
             (NOW() AT TIME ZONE $1)::date,
             INTERVAL '1 day') AS dia
      LEFT JOIN (
        SELECT (sc.finished_at AT TIME ZONE $1)::date AS d, COUNT(*) AS total
        FROM support_chats sc
        JOIN support_chat_status st ON st.id = sc.support_chat_status_id
        -- Pela flag, não por uma lista de ids: ver contarFinalizados.
        WHERE st.is_final = true AND sc.finished_at IS NOT NULL
        GROUP BY d
      ) c ON c.d = dia::date
      ORDER BY dia
      `,
      [FUSO_EXIBICAO],
    );

    return linhas as PontoSerie[];
  }

  /**
   * Em que horas os atendimentos começam, nos últimos 30 dias.
   *
   * Conta por `created_at` (quando a conversa abriu), não por `finished_at`:
   * a pergunta é quando a demanda chega, que é o que dimensiona escala.
   *
   * Trinta dias, e não sete, porque a distribuição por hora precisa de volume
   * para ter forma - uma semana espalhada em 24 faixas vira ruído.
   *
   * As 24 horas sempre voltam, inclusive as vazias: o eixo do gráfico é o dia
   * inteiro, e omitir a madrugada deformaria a curva.
   */
  async movimentoPorHora(): Promise<PontoHora[]> {
    const linhas = await this.supportChatsRepository.query(
      `
      SELECT h.hora::int AS hora, COALESCE(c.total, 0)::int AS total
      FROM generate_series(0, 23) AS h(hora)
      LEFT JOIN (
        SELECT EXTRACT(HOUR FROM (created_at AT TIME ZONE $1))::int AS h, COUNT(*) AS total
        FROM support_chats
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY h
      ) c ON c.h = h.hora
      ORDER BY h.hora
      `,
      [FUSO_EXIBICAO],
    );

    return linhas as PontoHora[];
  }
}
