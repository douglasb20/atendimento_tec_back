import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RedefinirSenhaDto {
  @IsString()
  @IsNotEmpty({ message: 'Token não informado' })
  token: string;

  /**
   * Mínimo de 6 caracteres, o mesmo do cadastro de usuário.
   *
   * Exigir mais aqui do que na criação seria incoerente: o usuário acabaria
   * com uma senha que o próprio cadastro não aceitaria.
   */
  @IsString()
  @IsNotEmpty({ message: 'Informe a nova senha' })
  @MinLength(6, { message: 'A senha precisa ter ao menos 6 caracteres' })
  password: string;
}
