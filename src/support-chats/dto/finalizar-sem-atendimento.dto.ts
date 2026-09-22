import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * O motivo do descarte.
 *
 * Opcional no contrato, mas a tela pede: saber *por que* tanta conversa foi
 * encerrada sem atendimento é o que justifica olhar o número depois.
 */
export class FinalizarSemAtendimentoDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  observation_user?: string;
}
