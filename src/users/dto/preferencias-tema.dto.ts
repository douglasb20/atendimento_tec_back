import { IsIn, IsOptional } from 'class-validator';

import { CORES_TEMA, CorTema, MODOS_TEMA, ModoTema } from '../temas';

/**
 * A escolha de tema do usuário.
 *
 * Os dois campos são opcionais e independentes: trocar só o modo (o toggle
 * claro/escuro) não deve exigir reenviar a cor, e vice-versa. Omitir preserva o
 * que está gravado.
 */
export class PreferenciasTemaDto {
  @IsOptional()
  @IsIn(CORES_TEMA as unknown as string[], {
    message: `Tema inválido. Valores aceitos: ${CORES_TEMA.join(', ')}`,
  })
  tema?: CorTema;

  @IsOptional()
  @IsIn(MODOS_TEMA as unknown as string[], {
    message: `Modo inválido. Valores aceitos: ${MODOS_TEMA.join(', ')}`,
  })
  modo_tema?: ModoTema;
}
