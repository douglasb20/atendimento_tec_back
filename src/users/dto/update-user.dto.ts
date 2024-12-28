import { OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateUserDto extends OmitType(CreateUserDto, ['password']) {
  lastlogin_at?: string;

  @IsString({ message: (opt) => `Campo ${opt.property} aceita somente formato string` })
  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  password?: string;
}
