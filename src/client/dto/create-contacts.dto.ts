import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateContactsDto {
  @IsOptional()
  @IsNumber()
  clients_id?: number;

  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  nome_contato: string;

  @IsOptional()
  @IsString()
  telefone_contato?: string;
}
