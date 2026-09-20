import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class EsqueciSenhaDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o e-mail' })
  @IsEmail({}, { message: 'Informe um e-mail válido' })
  email: string;
}
