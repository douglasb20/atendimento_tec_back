import { IsNotEmpty, IsString } from 'class-validator';

export class AssinarMeuAvatarDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o tipo do arquivo' })
  fileType: string;
}
