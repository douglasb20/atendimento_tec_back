import { Type } from 'class-transformer';
import { ValorCampoDto } from '@/custom-fields/dto/valor-campo.dto';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateContactsDto {
  id?: number;

  @IsOptional()
  @IsNumber()
  client_id?: number;

  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  name: string;

  /** Opcional: contato pode ser empresa ou ter só um apelido. */
  @IsOptional()
  @IsString()
  last_name?: string | null;

  @IsOptional()
  @IsString()
  phone?: string;

  /**
   * Os campos personalizados que quem edita escolheu para este contato.
   *
   * Omitir preserva o que já existe; array vazio remove todos - a mesma
   * semântica de `tag_ids` em clientes.
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ValorCampoDto)
  campos?: ValorCampoDto[];
}
