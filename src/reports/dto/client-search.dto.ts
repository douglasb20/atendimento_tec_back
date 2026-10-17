import { IsString, MinLength } from 'class-validator';

/**
 * A busca do autocomplete do relatório analítico por cliente/contato.
 *
 * Só o mínimo para escolher um resultado (`id`, `nome`, `tipo`) - não é a
 * mesma rota de `GET /clients`/`GET /contacts`, que trazem o cadastro
 * completo e exigem `client:view`/`contact:view`. Quem só tem a permissão do
 * relatório não precisaria enxergar CNPJ ou telefone de todo mundo.
 */
export class ClientSearchDto {
  /** Mínimo de 2 caracteres - buscar letra única traria resultado demais para um autocomplete. */
  @IsString()
  @MinLength(2, { message: 'Digite ao menos 2 caracteres para buscar' })
  termo: string;
}
