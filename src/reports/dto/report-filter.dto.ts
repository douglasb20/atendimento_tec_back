import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Converte o valor de uma query string em array de inteiros, aceitando um
 * único valor (`?x=1`) ou vários (`?x=1,2,3` ou `?x=1&x=2`, que o Express já
 * entrega como array) - os relatórios que ainda mandam um id só continuam
 * funcionando sem mudar nada no front deles.
 */
const paraArrayDeInteiros = ({ value }: { value: unknown }): number[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;

  const bruto = Array.isArray(value) ? value : String(value).split(',');
  const numeros = bruto.map(Number).filter((n) => Number.isInteger(n));

  return numeros.length ? numeros : undefined;
};

/** Como o relatório por cliente agrupa as linhas - ver `ClientReportGroupBy`. */
export type ClientReportGroupBy = 'client' | 'contact';

/**
 * A ordenação do relatório por cliente/contato - um dropdown de opções
 * pré-definidas, não ordenação livre por coluna: o relatório tem poucas
 * métricas, e nomear cada combinação ("Mais finalizados") é mais claro do
 * que um cabeçalho clicável, além de valer igual na tela e nas exportações.
 */
export const ORDENACOES_RELATORIO_CLIENTE = [
  'mais_atendimentos',
  'menos_atendimentos',
  'mais_finalizados',
  'menos_finalizados',
  'mais_em_aberto',
  'menos_em_aberto',
  'mais_tempo_total',
  'menos_tempo_total',
  'mais_espera_media',
  'menos_espera_media',
] as const;

export type ClientReportSortBy = (typeof ORDENACOES_RELATORIO_CLIENTE)[number];

/**
 * Filtros do relatório de atendimentos.
 *
 * Todos opcionais: sem nenhum, o relatório traz o período inteiro sem
 * recorte. O front sempre manda `de`/`ate` (o seletor abre em 7 dias), mas a
 * API não os exige - quem chama direto pode querer a base toda.
 *
 * ⚠️ Campos não declarados aqui são **descartados em silêncio** pelo
 * `ValidationPipe` global (`whitelist: true`): um filtro novo na tela sem o
 * campo correspondente aqui simplesmente não tem efeito, sem erro nenhum.
 */
export class ReportFilterDto {
  /**
   * Início do período, pela **abertura** do atendimento (`created_at`).
   *
   * Por `created_at` e não `finished_at`: a pergunta do relatório é "o que
   * entrou neste período", e um atendimento aberto no dia 30 e fechado no dia
   * 1º pertence ao mês em que chegou. Atendimento em aberto também aparece,
   * o que não aconteceria filtrando pelo encerramento.
   */
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'A data inicial é inválida' })
  de?: Date;

  /** Fim do período. O dia informado entra inteiro - ver `reports.service`. */
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'A data final é inválida' })
  ate?: Date;

  /**
   * Atendente que assumiu. Ausente = todos os atendentes.
   *
   * "Todos" é um item explícito do select na tela, não o campo vazio - mas na
   * API ele vira a ausência do parâmetro, que é como se diz "sem recorte" em
   * HTTP.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O atendente é inválido' })
  user_id?: number;

  /**
   * Setor(es). ⚠️ Preenchido só nos atendimentos abertos pelo modal "Novo
   * atendimento" (`criarNova`); os que chegam por mensagem do contato ficam
   * com setor nulo. Filtrar por setor hoje devolve bem pouca coisa.
   *
   * Array para suportar multiseleção (hoje só no relatório de Atendimentos) -
   * um id só (`?department_id=3`) continua funcionando normalmente.
   */
  @IsOptional()
  @Transform(paraArrayDeInteiros)
  @IsInt({ each: true, message: 'O setor é inválido' })
  department_id?: number[];

  /** Canal(is) (a conexão de WhatsApp) por onde o atendimento entrou. */
  @IsOptional()
  @Transform(paraArrayDeInteiros)
  @IsInt({ each: true, message: 'O canal é inválido' })
  channel_id?: number[];

  /** Cliente associado ao contato. */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O cliente é inválido' })
  client_id?: number;

  /** Só no relatório analítico por cliente/contato: o contato específico escolhido na busca. */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'O contato é inválido' })
  contact_id?: number;

  /**
   * Situação(ões) do atendimento. Ausente = todas.
   *
   * Array para suportar multiseleção (hoje só no relatório de Atendimentos) -
   * um id só continua funcionando normalmente.
   */
  @IsOptional()
  @Transform(paraArrayDeInteiros)
  @IsInt({ each: true, message: 'A situação é inválida' })
  support_chat_status_id?: number[];

  /** Busca livre por protocolo ou nome do contato. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  busca?: string;

  /**
   * Só no relatório por cliente: agrupar por `client` (a conta, que pode ter
   * vários contatos) ou por `contact` (o número de WhatsApp individual).
   * Ausente vira `client` - é a pergunta mais comum ("qual cliente consome
   * mais atendimento").
   */
  @IsOptional()
  @IsIn(['client', 'contact'], { message: 'O agrupamento é inválido' })
  agrupar_por?: ClientReportGroupBy;

  /**
   * Só no relatório por cliente: exclui a linha "Sem cliente"/"Sem contato".
   *
   * Switch explícito, desligado por padrão - ausente mostra tudo, igual aos
   * demais relatórios. Quem quer comparar só quem tem conta cadastrada liga
   * o filtro; a decisão não fica subentendida.
   */
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'O filtro de "ignorar sem cliente" é inválido' })
  ignorar_sem_cliente?: boolean;

  /**
   * Só no relatório por cliente: a ordenação escolhida no dropdown. Ausente
   * vira "mais atendimentos" - mesmo padrão que já existia antes deste
   * filtro existir, então não muda o comportamento de quem não escolhe nada.
   */
  @IsOptional()
  @IsIn(ORDENACOES_RELATORIO_CLIENTE, { message: 'A ordenação é inválida' })
  ordenar_por?: ClientReportSortBy;
}
