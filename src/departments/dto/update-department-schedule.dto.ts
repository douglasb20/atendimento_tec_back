import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Um intervalo de horário, como classe real (não interface solta) - o
 * `ValidationPipe` global (`transform: true` + `whitelist: true`) exige isso
 * para reconstruir corretamente cada item de `intervals` como objeto (e não
 * como instância de `Array`) e para não descartar os campos por falta de
 * decorator próprio. Bug real, já encontrado e corrigido no `SaveFlowDto` do
 * chatbot: sem `@Type(() => Classe)` e sem `@Is*` em cada campo, o grafo
 * inteiro ia para o banco como `[[], []]`/`[{}, {}]`.
 */
export class ScheduleIntervalDto {
  @IsInt()
  @Min(0)
  @Max(6)
  weekday: number;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Use o formato HH:mm' })
  start_time: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'Use o formato HH:mm' })
  end_time: string;
}

export class UpdateDepartmentScheduleDto {
  /** Switch mestre: desligado, o setor é sempre disponível, ignorando os
   * intervalos abaixo - sem isso, um dia sem nenhum intervalo virava
   * "fechado" mesmo quando o setor nunca tinha a intenção de restringir
   * horário nenhum. */
  @IsBoolean()
  schedule_enabled: boolean;

  @IsArray({ message: 'Informe os intervalos como lista' })
  @ValidateNested({ each: true })
  @Type(() => ScheduleIntervalDto)
  intervals: ScheduleIntervalDto[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  absence_message?: string | null;
}
