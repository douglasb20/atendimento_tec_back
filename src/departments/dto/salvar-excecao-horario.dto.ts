import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator';
import type { ModoExcecao } from '../entities/department-schedule-exceptions.entity';

export class IntervaloExcecaoDto {
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'O início deve estar entre 00:00 e 23:59' })
  start_time: string;

  @Matches(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, { message: 'O fim deve estar entre 00:00 e 24:00' })
  end_time: string;
}

export class SalvarExcecaoHorarioDto {
  @IsDateString({ strict: true }, { message: 'Informe uma data válida' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use uma data completa no formato AAAA-MM-DD' })
  date: string;

  @IsOptional()
  @IsBoolean({ message: 'Informe se a exceção se repete todos os anos' })
  recurring?: boolean = false;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  description: string;

  @IsIn(['fechado', 'normal', 'especial'])
  mode: ModoExcecao;

  @IsArray()
  @ArrayMaxSize(48)
  @ValidateNested({ each: true })
  @Type(() => IntervaloExcecaoDto)
  intervals: IntervaloExcecaoDto[];

  @IsOptional()
  @IsInt()
  @Min(1)
  holiday_id?: number | null;
}
