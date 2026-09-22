import { IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class TransferirAtendimentoDto {
  /**
   * Para quem vai o atendimento.
   *
   * ⚠️ Omitir (ou mandar nulo) **devolve a conversa para a espera**, sem dono,
   * em vez de ser um erro de validação. São os dois caminhos da mesma ação.
   */
  @IsOptional()
  @IsInt()
  @IsPositive()
  user_destino_id?: number | null;

  /** Por que está transferindo. Opcional por decisão de produto. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  motivo?: string;
}
