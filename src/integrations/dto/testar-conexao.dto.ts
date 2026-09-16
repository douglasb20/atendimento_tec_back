import { IsObject, IsOptional, IsPositive, IsString, IsUrl } from 'class-validator';

/**
 * Entrada do teste de conexão.
 *
 * Todos os campos são opcionais porque a tela chama em dois momentos: no
 * cadastro, com os dados ainda não salvos; e na listagem, com apenas o
 * `integration_id` — aí o que faltar é completado do que está gravado.
 */
export class TestarConexaoDto {
  /** Integração já salva; sem ele, o teste usa só o que veio no corpo. */
  @IsOptional()
  @IsPositive()
  integration_id?: number;

  /** Slug do provider (`evolution`, …). Obrigatório quando não há integração. */
  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsUrl({ require_tld: false }, { message: 'Informe uma URL válida' })
  base_url?: string;

  /** Vazio ao editar sem trocar a credencial — o service usa a gravada. */
  @IsOptional()
  @IsObject()
  credentials?: Record<string, string>;
}
