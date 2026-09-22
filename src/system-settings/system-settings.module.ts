import { Global, Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigMailerModule } from 'core/mailer/configmailer.module';
import { SystemSettings } from './entities/system-settings.entity';
import { SystemSettingsController } from './system-settings.controller';
import { SystemSettingsRepository } from './system-settings.repository';
import { SystemSettingsService } from './system-settings.service';

/**
 * `@Global` porque a validade do link de senha, a retenção de mídia e a
 * duração da sessão são lidas em módulos distintos - importar este em cada um
 * seria ruído sem ganho.
 *
 * O `forwardRef` com o mailer é um ciclo real: o mailer lê a configuração
 * daqui, e o controller daqui invalida o transporte do mailer.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SystemSettings]), forwardRef(() => ConfigMailerModule)],
  controllers: [SystemSettingsController],
  providers: [SystemSettingsService, SystemSettingsRepository],
  exports: [SystemSettingsService],
})
export class SystemSettingsModule {}
