import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserConfig } from './entities/user-config.entity';
import { UserConfigController } from './user-config.controller';
import { UserConfigRepository } from './user-config.repository';
import { UserConfigService } from './user-config.service';

/**
 * Preferências por usuário: tema e notificações.
 *
 * `@Global` porque o `UsersService` precisa dele para compor `/users/info` (é
 * de lá que sai o cookie `userInfo`), e importá-lo de volta criaria ciclo -
 * `UserConfigModule` não depende de `UsersModule`, mas o inverso sim.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([UserConfig])],
  controllers: [UserConfigController],
  providers: [UserConfigService, UserConfigRepository],
  exports: [UserConfigService],
})
export class UserConfigModule {}
