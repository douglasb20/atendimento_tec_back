import { Type } from 'class-transformer';
import { ValorCampoDto } from '@/custom-fields/dto/valor-campo.dto';
import {
  IsArray,
  IsBoolean,
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

  /** Contato que nunca terá cliente (fornecedor, parceiro etc) - marcado,
   * finalizar atendimento com ele deixa de exigir vínculo com cliente. */
  @IsOptional()
  @IsBoolean()
  has_no_client?: boolean;

  /** Marcado, a mensagem deste contato é descartada já no webhook - nunca
   * vira atendimento, protocolo ou histórico. */
  @IsOptional()
  @IsBoolean()
  ignore_support?: boolean;

  /** Key do bucket (upload manual) ou `null` para remover a foto manual e
   * voltar a buscar do WhatsApp. Ausente: nada muda. */
  @IsOptional()
  @IsString()
  avatar_url?: string | null;

  /** Sinaliza que o upload da key acima acabou de ser feito - vira
   * `avatar_is_manual: true` no service. */
  @IsOptional()
  @IsBoolean()
  changed_avatar?: boolean;

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
