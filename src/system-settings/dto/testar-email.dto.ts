import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

/**
 * Credenciais avulsas para testar antes de salvar.
 *
 * Campos omitidos usam o que já está configurado - é o que permite conferir uma
 * senha nova sem reenviar host e porta, e testar o que está gravado sem enviar
 * nada.
 */
export class TestarEmailDto {
  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(65535)
  port?: number;

  @IsOptional()
  @IsString()
  user?: string;

  @IsOptional()
  @IsString()
  pass?: string;

  /** Para onde mandar a mensagem de teste. */
  @IsString()
  @IsNotEmpty({ message: 'Informe o e-mail que vai receber o teste' })
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  destinatario: string;
}
