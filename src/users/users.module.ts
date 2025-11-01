import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Users } from './entities/users.entity';
import { ConfigMailerModule } from 'core/mailer/configmailer.module';
import { Supports } from 'supports/entities/supports.entity';
import { UserRepository } from './users.repository';
import { UserRefreshTokens } from './entities/user-refresh-tokens.entity';
import { PermissionsRepository } from 'permissions/permissions.repository';

@Module({
  imports: [TypeOrmModule.forFeature([Users, Supports, UserRefreshTokens]), ConfigMailerModule],
  controllers: [UsersController],
  providers: [UsersService, UserRepository, PermissionsRepository],
})
export class UsersModule {}
