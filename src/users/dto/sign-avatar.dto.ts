import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class SignAvatarDto {
  @IsNumber()
  @IsOptional()
  user_id?: number;

  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  key: string;

  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  fileType: string;
}
