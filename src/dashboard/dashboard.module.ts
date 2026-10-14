import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Contacts } from '@/contacts/entities/contacts.entity';
import { SupportChats } from '@/support-chats/entities/support-chats.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/**
 * Os números da home.
 *
 * Só lê, e por isso injeta os repositories do TypeORM direto em vez de
 * depender dos módulos de contato e atendimento: nada aqui grava, e assim o
 * módulo não entra no emaranhado de `forwardRef` daqueles dois.
 *
 * ⚠️ O `forFeature` é obrigatório mesmo com `autoLoadEntities`: sem ele o boot
 * passa e a primeira consulta quebra.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Contacts, SupportChats])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
