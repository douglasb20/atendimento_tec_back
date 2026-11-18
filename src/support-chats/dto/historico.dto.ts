import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

/**
 * Paginação opcional do histórico (`GET /support-chats/:id/messages`), para o
 * app mobile. Sem `limite` a rota devolve a conversa inteira, como o portal usa.
 */
export class HistoricoDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limite deve ser inteiro' })
  @Min(1, { message: 'limite mínimo é 1' })
  @Max(100, { message: 'limite máximo é 100' })
  limite?: number;

  /** `id` (uuid) da mensagem mais antiga que o app já tem. */
  @IsOptional()
  @IsUUID('all', { message: 'antes_de deve ser o id de uma mensagem' })
  antes_de?: string;
}
