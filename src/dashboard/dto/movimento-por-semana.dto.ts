import { IsIn, IsOptional } from 'class-validator';

export const PERIODOS_MOVIMENTO = [
  'esta_semana',
  'semana_passada',
  'este_mes',
  'ultimo_mes',
  'ultimos_seis_meses',
] as const;
export type PeriodoMovimento = typeof PERIODOS_MOVIMENTO[number];

export class MovimentoPorSemanaDto {
  @IsOptional()
  @IsIn(PERIODOS_MOVIMENTO, {
    message: 'Escolha Esta semana, Semana passada, Este mês, Último mês ou Últimos 6 meses',
  })
  periodo: PeriodoMovimento = 'esta_semana';
}
