import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SupportChatStatusId } from '@/@types';
import { Contacts } from '@/contacts/entities/contacts.entity';
import { SupportChats } from '@/support-chats/entities/support-chats.entity';
import { FUSO_EXIBICAO } from '@/core/fuso-exibicao';

/** Os quatro números dos cards da home. */
export type ResumoDashboard = {
  contatos: number;
  finalizados: number;
  emAtendimento: number;
  /** Média em segundos; `null` quando ainda não há atendimento finalizado. */
  tempoMedioSegundos: number | null;
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
  ) {}

  /**
   * Os quatro números de uma vez.
   *
   * Em paralelo porque são consultas independentes: em série, a home esperaria
   * a soma dos quatro tempos.
   */
  async resumo(): Promise<ResumoDashboard> {
    const [contatos, finalizados, emAtendimento, tempoMedioSegundos] = await Promise.all([
      this.contarContatos(),
      this.contarFinalizados(),
      this.contarEmAtendimento(),
      this.tempoMedioDeAtendimento(),
    ]);

    return { contatos, finalizados, emAtendimento, tempoMedioSegundos };
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
   * Só entram os que têm `finished_at`: sem ele não há intervalo a medir.
   */
  private async tempoMedioDeAtendimento(): Promise<number | null> {
    const { media } = await this.supportChatsRepository
      .createQueryBuilder('chat')
      .select(
        'AVG(GREATEST(EXTRACT(EPOCH FROM (chat.finished_at - chat.created_at)) - chat.paused_total_seconds, 0))',
        'media',
      )
      .innerJoin('support_chat_status', 'st', 'st.id = chat.support_chat_status_id')
      .where('st.is_final = true')
      .andWhere('chat.finished_at IS NOT NULL')
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
