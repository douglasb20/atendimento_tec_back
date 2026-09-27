import { IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';

export class AceitarConviteDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe seu nome' })
  name: string;

  @IsOptional()
  @IsString()
  last_name?: string | null;

  /**
   * Mínimo de 6 caracteres, o mesmo da redefinição de senha - exigir mais
   * aqui seria incoerente com o resto do sistema.
   */
  @IsString()
  @IsNotEmpty({ message: 'Informe uma senha' })
  @MinLength(6, { message: 'A senha precisa ter ao menos 6 caracteres' })
  password: string;
}
