import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Max, Min } from 'class-validator';

/** Paginação do histórico de uma conversa interna. */
export class ListarMensagensDto {
  /**
   * Teto para não deixar uma conversa longa devolver tudo de uma vez. O front
   * pede mais ao rolar para cima.
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;

  /**
   * O `created_at` da mensagem mais antiga já carregada.
   *
   * Cursor em vez de `offset`: com mensagem nova chegando durante a rolagem, o
   * offset repetiria ou pularia linhas.
   */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  antes_de?: Date;
}
