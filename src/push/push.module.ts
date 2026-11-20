import { Module } from '@nestjs/common';

import { DepartmentsModule } from '@/departments/departments.module';
import { DevicesModule } from '@/devices/devices.module';
import { EnvioFirebase } from './envio-firebase';
import { PushService } from './push.service';

/** Push do app pelo Firebase. `PermissionsModule` e `UserConfigModule` são globais. */
@Module({
  imports: [DevicesModule, DepartmentsModule],
  providers: [EnvioFirebase, PushService],
  exports: [PushService],
})
export class PushModule {}
