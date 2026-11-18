import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

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

  /**
   * Duração do áudio em segundos. O app manda (sabe o tempo da gravação) e o
   * back grava "MM:SS" no `content`, como nos áudios recebidos. O portal não
   * manda: lê a duração do próprio arquivo.
   */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  duration?: number;
}
