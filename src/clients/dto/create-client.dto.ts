import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  nome: string;

  @IsOptional()
  @IsString()
  cnpj?: string;
}
