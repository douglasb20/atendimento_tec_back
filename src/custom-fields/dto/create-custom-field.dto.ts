import { ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

import { APLICA_A_VALIDOS, AplicaA, TIPOS_VALIDOS, TipoCampo } from '../entities/custom-fields.entity';

export class CreateCustomFieldDto {
  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  @MaxLength(60, { message: 'O nome deve ter no máximo 60 caracteres' })
  nome: string;

  @IsIn(TIPOS_VALIDOS, { message: `O tipo deve ser um de: ${TIPOS_VALIDOS.join(', ')}` })
  tipo: TipoCampo;

  @IsIn(APLICA_A_VALIDOS, {
    message: `A aplicação deve ser uma de: ${APLICA_A_VALIDOS.join(', ')}`,
  })
  aplica_a: AplicaA;

  /**
   * Obrigatório quando `tipo = 'lista'`, ignorado nos demais.
   *
   * A regra é do serviço, não daqui: `class-validator` valida campo a campo, e
   * esta depende do `tipo` - deixá-la no DTO exigiria um validador próprio para
   * dizer o mesmo com menos clareza.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Informe ao menos uma opção' })
  @IsString({ each: true })
  opcoes?: string[];
}
