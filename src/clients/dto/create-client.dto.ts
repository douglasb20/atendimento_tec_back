import { IsArray, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
