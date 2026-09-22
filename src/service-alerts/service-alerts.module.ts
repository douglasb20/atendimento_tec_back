import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PermissionsModule } from '@/permissions/permissions.module';
import { ServiceAlerts } from './entities/service-alerts.entity';
import { ServiceAlertsController } from './service-alerts.controller';
import { ServiceAlertsRepository } from './service-alerts.repository';
import { ServiceAlertsService } from './service-alerts.service';

@Module({
  // ⚠️ O `forFeature` é obrigatório: o `DatabaseModule` usa
  // `autoLoadEntities`, que só registra a entidade quando algum módulo a
  // declara aqui. Sem ele o boot passa e a primeira consulta quebra com
  // "No metadata for ServiceAlerts was found".
  imports: [TypeOrmModule.forFeature([ServiceAlerts]), PermissionsModule],
  controllers: [ServiceAlertsController],
  providers: [ServiceAlertsService, ServiceAlertsRepository],
  // O `SupportChatsModule` usa para enviar os avisos na abertura da conversa.
  exports: [ServiceAlertsService],
})
export class ServiceAlertsModule {}
