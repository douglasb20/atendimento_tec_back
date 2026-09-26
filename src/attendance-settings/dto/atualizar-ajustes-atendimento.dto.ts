import { IsNotEmptyObject, IsObject } from 'class-validator';

export class AtualizarAjustesAtendimentoDto {
  /**
   * Pares chave-valor. A validação real acontece no serviço, contra o
   * catálogo: cada chave é um booleano, e repetir a regra aqui duplicaria o
   * que precisaria andar junto com o catálogo.
   */
  @IsObject()
  @IsNotEmptyObject({}, { message: 'Nenhum ajuste informado' })
  ajustes: Record<string, boolean>;
}
