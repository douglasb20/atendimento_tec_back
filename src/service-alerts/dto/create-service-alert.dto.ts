import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
  ValidateIf,
  IsIn,
} from 'class-validator';

export class CreateServiceAlertDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe um título para identificar o aviso' })
  @MaxLength(100)
  titulo: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe a mensagem que será enviada' })
  mensagem: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^service-alerts\/[\da-f-]+\.[^/]+$/i, { message: 'O anexo deve pertencer à pasta de avisos' })
  anexo_key?: string | null;

  @ValidateIf((dto: CreateServiceAlertDto) => Boolean(dto.anexo_key))
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do anexo' })
  @MaxLength(255)
  anexo_nome?: string | null;

  @ValidateIf((dto: CreateServiceAlertDto) => Boolean(dto.anexo_key))
  @IsString()
  @IsNotEmpty({ message: 'Informe o tipo do arquivo' })
  @MaxLength(100)
  anexo_mimetype?: string | null;

  @ValidateIf((dto: CreateServiceAlertDto) => Boolean(dto.anexo_key))
  @IsIn(['image', 'video', 'audio', 'document'])
  anexo_tipo?: string | null;

  /** Nasce ligado: quem cadastra um aviso está no meio do incidente. */
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expira_em?: Date | null;

  /** Vazio ou ausente = todos os canais. */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  channel_ids?: number[];
}
