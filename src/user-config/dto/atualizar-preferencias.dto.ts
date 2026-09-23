import { IsNotEmptyObject, IsObject } from 'class-validator';

/**
 * As preferências a gravar.
 *
 * Só `objeto não vazio` aqui: a validação real é chave a chave, no service,
 * contra o catálogo - é lá que está o tipo e a lista de valores aceitos de cada
 * uma. Mesmo desenho de `AtualizarAjustesDto`.
 */
export class AtualizarPreferenciasDto {
  @IsObject()
  @IsNotEmptyObject()
  preferencias: Record<string, string | boolean>;
}
