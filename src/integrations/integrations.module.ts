import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from 'auth/auth.module';
import { IntegrationProviders } from './entities/integration-provider.entity';
import { Integrations } from './entities/integrations.entity';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsRepository } from './integrations.repository';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Integrations, IntegrationProviders]), AuthModule],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, IntegrationsRepository],
  exports: [IntegrationsService, IntegrationsRepository],
})
export class IntegrationsModule {}
