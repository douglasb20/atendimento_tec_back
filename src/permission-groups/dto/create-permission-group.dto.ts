import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePermissionGroupDto {
  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  @MaxLength(60)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  description?: string;

  /**
   * Ids das permissões do grupo.
   *
   * Lista completa, não incremento: o que vier aqui passa a ser exatamente o
   * que o grupo tem. Enviar vazio deixa o grupo sem permissão alguma, que é
   * escolha legítima - um grupo em construção.
   */
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  permission_ids: number[];
}
