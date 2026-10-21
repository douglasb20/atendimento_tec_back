import { IsDateString } from 'class-validator';

/** Intervalo visível no calendário. Fim é exclusivo, como na regra de conflito. */
export class ListSchedulesDto {
  @IsDateString({}, { message: 'Informe o início do intervalo' })
  inicio_em: string;

  @IsDateString({}, { message: 'Informe o fim do intervalo' })
  fim_em: string;
}
