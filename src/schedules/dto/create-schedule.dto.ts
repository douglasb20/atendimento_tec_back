import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateScheduleDto {
  @IsString()
  @IsNotEmpty({ message: 'O título é obrigatório' })
  @MaxLength(160)
  titulo: string;

  @IsOptional()
  @IsString()
  observacao?: string | null;

  @IsDateString({}, { message: 'Informe uma data/hora de início válida' })
  inicio_em: string;

  @IsDateString({}, { message: 'Informe uma data/hora de fim válida' })
  fim_em: string;

  @Type(() => Number)
  @IsInt()
  @IsIn([5, 10, 15, 20, 25, 30, 60], { message: 'Informe uma antecedência de lembrete válida' })
  lembrete_minutos: number;

  /** Ausente = o próprio usuário logado. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  user_id?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  client_id?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  contact_id?: number | null;

  /** Só vem após o front exibir os compromissos que conflitam. */
  @IsOptional()
  @IsBoolean()
  confirmar_conflito?: boolean;
}
