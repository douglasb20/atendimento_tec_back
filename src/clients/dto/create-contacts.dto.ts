import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateContactsDto {
  id?: number;

  @IsOptional()
  @IsNumber()
  client_id?: number;

  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  nome_contato: string;

  @IsOptional()
  @IsString()
  telefone_contato?: string;
}
