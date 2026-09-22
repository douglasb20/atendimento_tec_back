import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class FinalizarAtendimentoDto {
  /** Relato do atendente sobre o atendimento. Opcional por decisão de produto. */
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observation_user?: string;

  /**
   * Encerra sem mandar a mensagem de despedida do canal.
   *
   * Há conversa que termina com o cliente já resolvido e despedido; repetir o
   * texto padrão soa automático.
   */
  @IsOptional()
  @IsBoolean()
  sem_despedida?: boolean;
}
