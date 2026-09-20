import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigMailerModule } from 'core/mailer/configmailer.module';
import { UsersModule } from '@/users/users.module';
import { PasswordResets } from './entities/password-resets.entity';
import { PasswordResetController } from './password-reset.controller';
import { PasswordResetRepository } from './password-reset.repository';
import { PasswordResetService } from './password-reset.service';

@Module({
  imports: [TypeOrmModule.forFeature([PasswordResets]), ConfigMailerModule, UsersModule],
  controllers: [PasswordResetController],
  providers: [PasswordResetService, PasswordResetRepository],
  exports: [PasswordResetService],
})
export class PasswordResetModule {}
