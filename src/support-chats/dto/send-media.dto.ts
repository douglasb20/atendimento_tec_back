import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export enum SendMediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  /** Mensagem de voz gravada na hora (PTT) - bolha com forma de onda. */
  VOICE = 'voice',
  DOCUMENT = 'document',
  STICKER = 'sticker',
}

export class SendMediaDto {
  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  chat_id: string;

  /**
   * Chave do objeto no storage, devolvida pelo fluxo de upload assinado.
   * O backend monta a URL pública a partir dela e a repassa ao provider, que
   * baixa o arquivo direto - sem trafegar bytes por aqui.
   */
  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  media_key: string;

  @IsEnum(SendMediaType, { message: 'Tipo de mídia inválido' })
  media_type: SendMediaType;

  @IsOptional()
  @IsString()
  mimetype?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  caption?: string;

  @IsOptional()
  @IsString()
  file_name?: string;

  /** Quando informado, a mídia é enviada como resposta a esta mensagem. */
  @IsOptional()
  @IsString()
  quoted_message_id?: string;
}
