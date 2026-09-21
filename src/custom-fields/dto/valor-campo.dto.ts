import { IsInt, IsNotEmpty, IsString } from 'class-validator';

/**
 * Um campo personalizado preenchido num contato ou cliente.
 *
 * Vive no módulo de campos, e não no de contatos: os dois lados usam o mesmo
 * formato, e pôr a definição num deles faria o outro importar de um vizinho
 * sem relação.
 */
export class ValorCampoDto {
  @IsInt()
  custom_field_id: number;

  @IsString()
  @IsNotEmpty({ message: 'Informe o valor do campo' })
  valor: string;
}
