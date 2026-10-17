import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';

import { FUSO_EXIBICAO } from '@/core/fuso-exibicao';
import { Permissions } from '@/permissions/permissions.decorator';
import { PermissionGuard } from '@/permissions/permissions.guard';
import { nomeCompleto } from '@/Utils';
import { ClientResolveDto } from './dto/client-resolve.dto';
import { ClientSearchDto } from './dto/client-search.dto';
import { ReportFilterDto } from './dto/report-filter.dto';
import { ReportTemplateService } from './report-template.service';
import { ReportExcelService } from './report-excel.service';
import { ReportPdfService } from './report-pdf.service';
import { AttendanceReport, ClientReport, ProductivityReport, ReportsService } from './reports.service';

/** Os arquivos `templates/reports/<nome>.report.json`. */
const TEMPLATE_ATENDIMENTOS = 'attendance';
const TEMPLATE_PRODUTIVIDADE = 'productivity';
const TEMPLATE_CLIENTE = 'client';
const TEMPLATE_CLIENTE_DETALHE = 'client-detail';

/**
 * Os relatórios do atendimento.
 *
 * **Uma permissão por relatório**, não uma só para o módulo: produtividade por
 * atendente é dado de supervisão, e pode caber a um grupo que não vê o resto -
 * ou o contrário. Nada aqui usa `@SemPermissao()`, ao contrário do dashboard:
 * lá são contagens agregadas que todo papel vê na home; aqui são as conversas
 * uma a uma, com nome de contato e de atendente.
 */
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportPdfService: ReportPdfService,
    private readonly reportExcelService: ReportExcelService,
    private readonly reportTemplateService: ReportTemplateService,
  ) {}

  @Get('attendance')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('report.attendance:view')
  @HttpCode(HttpStatus.OK)
  async atendimentos(@Query() filtro: ReportFilterDto): Promise<AttendanceReport> {
    return this.reportsService.atendimentos(filtro);
  }

  @Get('attendance/pdf')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('report.attendance:view')
  async atendimentosPdf(
    @Query() filtro: ReportFilterDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { relatorio, filtros, template } = await this.monta(filtro);

    const pdf = await this.reportPdfService.gerar({
      titulo: template.title,
      periodo: this.reportsService.descrevePeriodo(filtro),
      filtros,
      colunas: this.reportTemplateService.colunasDoPdf(template),
      linhas: relatorio.linhas,
      // Sem texto de resumo na linha de total (o template de atendimentos não
      // declara `total.label`): "9 atendimentos" não é soma de nenhuma coluna
      // da tabela, então vai na caixa de `resumoFinal` - só os valores de
      // Espera/Duração ficam aqui, que são soma/média de colunas reais.
      total: this.reportTemplateService.totalDoPdf(template, relatorio.totais),
      resumoFinal: this.reportTemplateService.resumoFinal(template, relatorio.totais),
      geradoPor: this.assinatura(req),
    });

    this.entrega(res, pdf, 'application/pdf', this.nomeDoArquivo(template.fileName, 'pdf'));
  }

  @Get('attendance/excel')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('report.attendance:view')
  async atendimentosExcel(
    @Query() filtro: ReportFilterDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { relatorio, filtros, template } = await this.monta(filtro);

    const excel = await this.reportExcelService.gerar({
      titulo: template.title,
      periodo: this.reportsService.descrevePeriodo(filtro),
      filtros,
      colunas: this.reportTemplateService.colunasDoExcel(template),
      linhas: relatorio.linhas,
      totais: this.reportTemplateService.totalDoExcel(template, relatorio.totais),
      resumoFinal: this.reportTemplateService.resumoFinal(template, relatorio.totais),
      geradoPor: this.assinatura(req),
    });

    this.entrega(
      res,
      excel,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      this.nomeDoArquivo(template.fileName, 'xlsx'),
    );
  }

  @Get('productivity')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('report.productivity:view')
  @HttpCode(HttpStatus.OK)
  async produtividade(@Query() filtro: ReportFilterDto): Promise<ProductivityReport> {
    return this.reportsService.produtividade(filtro);
  }

  @Get('productivity/pdf')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('report.productivity:view')
  async produtividadePdf(
    @Query() filtro: ReportFilterDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { relatorio, filtros, template } = await this.montaProdutividade(filtro);

    const pdf = await this.reportPdfService.gerar({
      titulo: template.title,
      periodo: this.reportsService.descrevePeriodo(filtro),
      filtros,
      colunas: this.reportTemplateService.colunasDoPdf(template),
      linhas: relatorio.linhas,
      // O texto "Total geral" vem do `total.label` do próprio template
      // (`productivity.report.json`) - cada número do rodapé já vai sob a
      // própria coluna (Total, Finalizados, ...), então o rótulo aqui é só
      // identificação da linha, não repetição do que a tabela já mostra.
      total: this.reportTemplateService.totalDoPdf(template, relatorio.totais),
      geradoPor: this.assinatura(req),
    });

    this.entrega(res, pdf, 'application/pdf', this.nomeDoArquivo(template.fileName, 'pdf'));
  }

  @Get('productivity/excel')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('report.productivity:view')
  async produtividadeExcel(
    @Query() filtro: ReportFilterDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { relatorio, filtros, template } = await this.montaProdutividade(filtro);

    const excel = await this.reportExcelService.gerar({
      titulo: template.title,
      periodo: this.reportsService.descrevePeriodo(filtro),
      filtros,
      colunas: this.reportTemplateService.colunasDoExcel(template),
      linhas: relatorio.linhas,
      totais: this.reportTemplateService.totalDoExcel(template, relatorio.totais),
      geradoPor: this.assinatura(req),
    });

    this.entrega(
      res,
      excel,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      this.nomeDoArquivo(template.fileName, 'xlsx'),
    );
  }

  @Get('client')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('report.client:view')
  @HttpCode(HttpStatus.OK)
  async porCliente(@Query() filtro: ReportFilterDto): Promise<ClientReport> {
    return this.reportsService.porCliente(filtro);
  }

  @Get('client/pdf')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('report.client:view')
  async porClientePdf(
    @Query() filtro: ReportFilterDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { relatorio, filtros, template } = await this.montaPorCliente(filtro);

    const pdf = await this.reportPdfService.gerar({
      titulo: template.title,
      periodo: this.reportsService.descrevePeriodo(filtro),
      filtros,
      colunas: this.reportTemplateService.colunasDoPdf(template),
      linhas: relatorio.linhas,
      // Mesma régua de atendimentos: "9 atendimentos" não é soma de nenhuma
      // coluna da tabela, então vai na caixa de `resumoFinal` - só os
      // valores de Espera/Duração ficam aqui, que são soma/média de colunas reais.
      total: this.reportTemplateService.totalDoPdf(template, relatorio.totais),
      resumoFinal: this.reportTemplateService.resumoFinal(template, relatorio.totais),
      geradoPor: this.assinatura(req),
    });

    this.entrega(res, pdf, 'application/pdf', this.nomeDoArquivo(template.fileName, 'pdf'));
  }

  @Get('client/excel')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('report.client:view')
  async porClienteExcel(
    @Query() filtro: ReportFilterDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { relatorio, filtros, template } = await this.montaPorCliente(filtro);

    const excel = await this.reportExcelService.gerar({
      titulo: template.title,
      periodo: this.reportsService.descrevePeriodo(filtro),
      filtros,
      colunas: this.reportTemplateService.colunasDoExcel(template),
      linhas: relatorio.linhas,
      totais: this.reportTemplateService.totalDoExcel(template, relatorio.totais),
      resumoFinal: this.reportTemplateService.resumoFinal(template, relatorio.totais),
      geradoPor: this.assinatura(req),
    });

    this.entrega(
      res,
      excel,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      this.nomeDoArquivo(template.fileName, 'xlsx'),
    );
  }

  @Get('client-detail/search')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('report.client_detail:view')
  @HttpCode(HttpStatus.OK)
  async buscarClienteOuContato(@Query() { termo }: ClientSearchDto) {
    return this.reportsService.buscarClienteOuContato(termo);
  }

  /**
   * Resolve o nome de um cliente/contato pelo `id` - usado quando a tela
   * abre pré-filtrada (vinda de uma linha do relatório por cliente), para a
   * busca nascer já mostrando quem foi escolhido.
   */
  @Get('client-detail/resolve')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('report.client_detail:view')
  @HttpCode(HttpStatus.OK)
  async resolverClienteOuContato(@Query() { id, tipo }: ClientResolveDto) {
    return this.reportsService.resolverClienteOuContato(id, tipo);
  }

  /**
   * O relatório analítico é a mesma consulta de `atendimentos()`, filtrada
   * por um cliente ou contato específico - `client_id`/`contact_id` vêm do
   * resultado escolhido na busca acima. Reaproveita `AttendanceReport`: não
   * há tipo de linha próprio, é literalmente o relatório de atendimentos
   * recortado para uma pessoa só.
   */
  @Get('client-detail')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('report.client_detail:view')
  @HttpCode(HttpStatus.OK)
  async detalheDoCliente(@Query() filtro: ReportFilterDto): Promise<AttendanceReport> {
    return this.reportsService.atendimentos(filtro);
  }

  @Get('client-detail/pdf')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('report.client_detail:view')
  async detalheDoClientePdf(
    @Query() filtro: ReportFilterDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { relatorio, filtros, template } = await this.montaDetalheDoCliente(filtro);

    const pdf = await this.reportPdfService.gerar({
      titulo: template.title,
      periodo: this.reportsService.descrevePeriodo(filtro),
      filtros,
      colunas: this.reportTemplateService.colunasDoPdf(template),
      linhas: relatorio.linhas,
      total: this.reportTemplateService.totalDoPdf(template, relatorio.totais),
      resumoFinal: this.reportTemplateService.resumoFinal(template, relatorio.totais),
      geradoPor: this.assinatura(req),
    });

    this.entrega(res, pdf, 'application/pdf', this.nomeDoArquivo(template.fileName, 'pdf'));
  }

  @Get('client-detail/excel')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('report.client_detail:view')
  async detalheDoClienteExcel(
    @Query() filtro: ReportFilterDto,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const { relatorio, filtros, template } = await this.montaDetalheDoCliente(filtro);

    const excel = await this.reportExcelService.gerar({
      titulo: template.title,
      periodo: this.reportsService.descrevePeriodo(filtro),
      filtros,
      colunas: this.reportTemplateService.colunasDoExcel(template),
      linhas: relatorio.linhas,
      totais: this.reportTemplateService.totalDoExcel(template, relatorio.totais),
      resumoFinal: this.reportTemplateService.resumoFinal(template, relatorio.totais),
      geradoPor: this.assinatura(req),
    });

    this.entrega(
      res,
      excel,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      this.nomeDoArquivo(template.fileName, 'xlsx'),
    );
  }

  /**
   * Os dados, a descrição dos filtros e o template - tudo que as duas
   * exportações precisam.
   *
   * As duas consultas vão em paralelo por serem independentes: a descrição
   * dos filtros resolve nomes, não toca nos atendimentos. O template vem do
   * disco, já em cache.
   */
  private async monta(filtro: ReportFilterDto) {
    const [relatorio, filtros] = await Promise.all([
      this.reportsService.atendimentos(filtro),
      this.reportsService.descreveFiltros(filtro),
    ]);

    return {
      relatorio,
      filtros,
      template: this.reportTemplateService.carregar(TEMPLATE_ATENDIMENTOS),
    };
  }

  /** Mesma ideia de `monta`, para o relatório de produtividade. */
  private async montaProdutividade(filtro: ReportFilterDto) {
    const [relatorio, filtros] = await Promise.all([
      this.reportsService.produtividade(filtro),
      // Cliente, Situação e Busca não descrevem nada num relatório agrupado
      // por atendente - ver o comentário em `descreveFiltros`.
      this.reportsService.descreveFiltros(filtro, { incluirSituacaoEBusca: false }),
    ]);

    return {
      relatorio,
      filtros,
      template: this.reportTemplateService.carregar(TEMPLATE_PRODUTIVIDADE),
    };
  }

  /** Mesma ideia de `monta`, para o relatório por cliente/contato. */
  private async montaPorCliente(filtro: ReportFilterDto) {
    const [relatorio, filtros] = await Promise.all([
      this.reportsService.porCliente(filtro),
      // Cliente, Situação e Busca não descrevem nada num relatório agrupado -
      // aqui entra "Agrupado por" e "Sem cliente" no lugar deles.
      this.reportsService.descreveFiltros(filtro, {
        incluirSituacaoEBusca: false,
        incluirAgrupamento: true,
      }),
    ]);

    return {
      relatorio,
      filtros,
      template: this.reportTemplateService.carregar(TEMPLATE_CLIENTE),
    };
  }

  /**
   * Mesma ideia de `monta`, para o relatório analítico - é o mesmo método de
   * dados (`atendimentos`), só muda o template usado na exportação.
   */
  private async montaDetalheDoCliente(filtro: ReportFilterDto) {
    const [relatorio, filtros] = await Promise.all([
      this.reportsService.atendimentos(filtro),
      this.reportsService.descreveFiltros(filtro),
    ]);

    return {
      relatorio,
      filtros,
      template: this.reportTemplateService.carregar(TEMPLATE_CLIENTE_DETALHE),
    };
  }

  /** `Gerado por Fulano de Tal em 16/10/2026 20:42` para o rodapé. */
  private assinatura(req: Request): string {
    // Nome completo sempre, ao contrário da assinatura das mensagens (que
    // respeita o ajuste `assinatura_nome_completo`): ali o texto vai ao
    // cliente e a preferência é de identidade; aqui é registro de auditoria,
    // e quem gerou o relatório precisa ficar identificável sem ambiguidade.
    const nome =
      nomeCompleto({
        name: req.user?.['name'],
        last_name: req.user?.['last_name'],
      }) || 'sistema';

    const agora = new Date().toLocaleString('pt-BR', {
      timeZone: FUSO_EXIBICAO,
      dateStyle: 'short',
      timeStyle: 'short',
    });

    return `Gerado por ${nome} em ${agora}`;
  }

  /**
   * `atendimentos_2026_10_17.pdf` - o nome vem do template; a data é a da
   * geração, não a do filtro.
   *
   * Underscore em vez de hífen, inclusive na data: o nome do arquivo vira uma
   * palavra só, sem ponto de quebra ao ser colado em e-mail ou terminal.
   */
  private nomeDoArquivo(base: string, extensao: string): string {
    const hoje = new Date().toISOString().slice(0, 10).replace(/-/g, '_');
    return `${base}_${hoje}.${extensao}`;
  }

  /**
   * `attachment`, não `inline`: o navegador baixa o arquivo em vez de tentar
   * abri-lo numa aba - que é o que se espera de um botão "Exportar".
   */
  private entrega(res: Response, arquivo: Buffer, tipo: string, nome: string): void {
    res.set({
      'Content-Type': tipo,
      'Content-Disposition': `attachment; filename="${nome}"`,
      'Content-Length': String(arquivo.length),
    });

    res.end(arquivo);
  }
}
