import { IsObject, IsNotEmptyObject } from 'class-validator';

export class AtualizarAjustesDto {
  /**
   * Pares chave-valor. A validação real acontece no serviço, contra o catálogo:
   * cada chave tem tipo e faixa próprios, e repeti-los aqui seria duplicar a
   * mesma regra em dois lugares que precisariam andar juntos.
   */
  @IsObject()
  @IsNotEmptyObject({}, { message: 'Nenhum ajuste informado' })
  ajustes: Record<string, string | number>;
}
