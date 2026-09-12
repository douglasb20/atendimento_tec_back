import { IsOptional, IsString, MaxLength } from 'class-validator';

export class FinalizarAtendimentoDto {
  /** Relato do atendente sobre o atendimento. Opcional por decisão de produto. */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observation_user?: string;
}
