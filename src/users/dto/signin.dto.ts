import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SigninDto {
  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  @MinLength(4, { message: 'Senha deve ter mais de 4 caracteres' })
  password: string;
}
