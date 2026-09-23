import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { InternalMessageType } from '../internal-chat.types';

export class SendInternalMessageDto {
  @IsEnum(InternalMessageType, { message: 'Tipo de mensagem inválido' })
  type: InternalMessageType;

  /**
   * O texto, ou a legenda quando há mídia.
   *
   * Obrigatório só no tipo `text`: uma foto sem legenda é mensagem legítima, um
   * texto vazio não é.
   */
  @ValidateIf((dto: SendInternalMessageDto) => dto.type === InternalMessageType.TEXT)
  @IsString()
  @IsNotEmpty({ message: 'A mensagem não pode ficar vazia' })
  @MaxLength(4096)
  content?: string;

  /**
   * A **key** devolvida por `sign-media`, não a URL.
   *
   * Obrigatória em tudo que não é texto - o arquivo já subiu direto para o
   * storage, e aqui só chega a referência.
   */
  @ValidateIf((dto: SendInternalMessageDto) => dto.type !== InternalMessageType.TEXT)
  @IsString()
  @IsNotEmpty({ message: 'Envie o arquivo antes de mandar a mensagem' })
  @MaxLength(255)
  media_key?: string;

  @IsOptional()
  @IsString()
  // 100: o mimetype de um `.docx` tem 65 caracteres. O do atendimento cabe em
  // 20 porque só recebe tipos do WhatsApp.
  @MaxLength(100)
  mimetype?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  media_size?: number;

  /** Nome original - é o que identifica um documento na conversa. */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  file_name?: string;
}
