import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AssinarAnexoAvisoDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o tipo do arquivo' })
  @MaxLength(100)
  fileType: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do arquivo' })
  @MaxLength(255)
  fileName: string;
}
