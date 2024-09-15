import { Type } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Contacts } from 'client/entities/contacts.entity';
import { CreateContactsDto } from './create-contacts.dto';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  nome: string;

  @IsOptional()
  @IsString()
  cnpj?: string;

  @ValidateNested({ each: true })
  @Type(() => CreateContactsDto)
  contacts: Contacts[];
}
