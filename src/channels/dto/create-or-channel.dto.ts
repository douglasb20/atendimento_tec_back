import { IsNotEmpty, IsString } from 'class-validator';

export class CreateOrChannelDto {
  @IsString({ message: (opt) => `Campo ${opt.property} aceita somente formato string` })
  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  name: string;
}
