import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

/**
 * Envelope do webhook da Evolution API.
 *
 * Só os campos que o roteamento usa são validados; `data` varia por evento e é
 * normalizado adiante pelo EvolutionMapper. Um envelope inválido resulta em 400,
 * o que também interrompe o retry da Evolution (ela não repete 4xx).
 */
export class EvolutionWebhookDto {
  @IsString()
  @IsNotEmpty({ message: 'O campo event é obrigatório' })
  event: string;

  /** Nome da instância na Evolution, correspondente ao `session_id` do canal. */
  @IsString()
  @IsNotEmpty({ message: 'O campo instance é obrigatório' })
  instance: string;

  @IsOptional()
  data?: unknown;

  @IsOptional()
  @IsString()
  sender?: string;

  @IsOptional()
  @IsString()
  date_time?: string;

  @IsOptional()
  @IsString()
  destination?: string;

  @IsOptional()
  @IsString()
  server_url?: string;

  /** Vem nulo salvo configuração específica na Evolution; não usar para autenticar. */
  @IsOptional()
  apikey?: string | null;

  @IsOptional()
  isLatest?: boolean;

  @IsOptional()
  progress?: number;

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}
