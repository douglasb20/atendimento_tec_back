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
} from 'class-validator';

export class CreateServiceAlertDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe um título para identificar o aviso' })
  @MaxLength(100)
  titulo: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe a mensagem que será enviada' })
  mensagem: string;

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
