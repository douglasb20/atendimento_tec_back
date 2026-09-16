import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from 'auth/auth.module';
import { WhatsappModule } from 'whatsapp/whatsapp.module';
import { IntegrationProviders } from './entities/integration-provider.entity';
import { Integrations } from './entities/integrations.entity';
import { IntegrationsController } from './integrations.controller';
import { IntegrationsRepository } from './integrations.repository';
import { IntegrationsService } from './integrations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Integrations, IntegrationProviders]),
    AuthModule,
    // Ciclo real: o WhatsappModule provê a ProviderFactory, que por sua vez
    // depende deste módulo para resolver as credenciais da integração.
    forwardRef(() => WhatsappModule),
  ],
  controllers: [IntegrationsController],
  providers: [IntegrationsService, IntegrationsRepository],
  exports: [IntegrationsService, IntegrationsRepository],
})
export class IntegrationsModule {}
