import { IsNotEmpty, IsString } from 'class-validator';

export class SignMediaPostDto {
  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  key: string;

  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  fileType: string;
}
