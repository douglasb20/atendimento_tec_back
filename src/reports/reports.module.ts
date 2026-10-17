import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SupportChats } from '@/support-chats/entities/support-chats.entity';
import { ReportExcelService } from './report-excel.service';
import { ReportPdfService } from './report-pdf.service';
import { ReportTemplateService } from './report-template.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

/**
 * Relatórios do atendimento.
 *
 * Mesmo desenho do `DashboardModule`, e pelo mesmo motivo: só lê, então
 * injeta o repository do TypeORM direto em vez de depender do módulo de
 * atendimento - assim não entra no emaranhado de `forwardRef` dele.
 *
 * ⚠️ O `forFeature` é obrigatório mesmo com `autoLoadEntities`: sem ele o
 * boot passa e a primeira consulta quebra.
 */
@Module({
  imports: [TypeOrmModule.forFeature([SupportChats])],
  controllers: [ReportsController],
  providers: [ReportsService, ReportPdfService, ReportExcelService, ReportTemplateService],
})
export class ReportsModule {}
