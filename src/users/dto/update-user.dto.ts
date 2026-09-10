import { OmitType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateUserDto extends OmitType(CreateUserDto, ['password']) {
  lastlogin_at?: string;

  @IsOptional()
  password?: string;

  @IsBoolean()
  @IsOptional()
  changed_avatar?: boolean;
}
