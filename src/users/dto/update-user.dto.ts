import { OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateUserDto extends OmitType(CreateUserDto, ['password']) {
  lastlogin_at?: string;

  @IsOptional()
  password?: string;
}
