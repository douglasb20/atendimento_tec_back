import { Transform } from 'class-transformer';
import { IsDecimal, IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString({ message: (opt) => `Campo ${opt.property} aceita somente formato string` })
  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  name: string;

  @IsString()
  @IsEmail({}, { message: (opt) => `Formato do campo ${opt.property} inválido` })
  email: string;

  @IsString({ message: (opt) => `Campo ${opt.property} aceita somente formato string` })
  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  password: string;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber({}, { message: (opt) => `Campo ${opt.property} aceita somente formato numérico` })
  valor_hora?: number;

  @IsString({ message: (opt) => `Campo ${opt.property} aceita somente formato string` })
  @IsOptional()
  role?: string;
}
