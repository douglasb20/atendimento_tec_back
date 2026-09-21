import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString, ValidateNested} from 'class-validator';
import { Type } from 'class-transformer';
import { ValorCampoDto } from '@/custom-fields/dto/valor-campo.dto';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  nome: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  /**
   * Etiquetas do cliente. Omitir o campo preserva as que já estão vinculadas;
   * enviar um array vazio remove todas.
   */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true, message: 'Informe ids de etiqueta válidos' })
  tag_ids?: number[];

  /**
   * Campos personalizados escolhidos para este cliente.
   *
   * Mesma semântica de `tag_ids`: omitir preserva, array vazio remove todos.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValorCampoDto)
  campos?: ValorCampoDto[];
}
