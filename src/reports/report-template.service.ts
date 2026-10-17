import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { duracaoCompacta, duracaoEmHoras } from '@/Utils';
import { FUSO_EXIBICAO } from '@/core/fuso-exibicao';
import { ExcelColumn } from './report-excel.service';
import { ReportColumn, ReportTotal } from './report-pdf.service';

/** Como o JSON descreve uma coluna. */
type ColunaDoTemplate = {
  title: string;
  /** Chave da linha devolvida pela consulta. */
  field: string;
  width?: string | number;
  /** Usado nas duas saídas: no PDF, alinhamento do texto; no Excel, alinhamento da célula. */
  align?: 'left' | 'right' | 'center';
  /** Texto da célula sem valor (só PDF). */
  empty?: string;
  /**
   * `duration` (segundos legíveis), `duration_hours` (idem, mas nunca vira
   * dias - usado só no "Tempo total") ou `shortDateTime`. Ausente, usa o
   * valor cru.
   */
  format?: string;
  /** Excel: `date` ou `number`. Ausente, texto. */
  type?: 'date' | 'number';
};

type TemplateDoRelatorio = {
  title: string;
  fileName: string;
  pdf: {
    columns: ColunaDoTemplate[];
    total?: {
      summaryColumns: number;
      /** Texto da primeira célula da linha de total. Ausente, fica em branco. */
      label?: string;
      averages?: {
        column: string;
        field: string;
        label?: string;
        /** `duration` (padrão), `duration_hours` ou `number` - uma contagem não vira "Xh Ymin". */
        format?: 'duration' | 'duration_hours' | 'number';
      }[];
    };
    /**
     * A caixa de resumo depois da tabela (ver `resumoFinal` em
     * `report-pdf.service.ts`) - para contagens sem coluna correspondente,
     * como "9 atendimentos", que não são soma de nenhuma coluna da tabela.
     */
    summary?: {
      /** Texto do cabeçalho da caixa, ex.: "Total geral". */
      title: string;
      items: { label: string; field: string; format?: 'number' | 'duration' | 'duration_hours' }[];
    };
  };
  excel: {
    columns: ColunaDoTemplate[];
    /**
     * A linha de totais no fim da planilha. Ao contrário do PDF, aqui não há
     * limite de espaço sob uma coluna - todo total cabe na mesma linha, sob
     * sua própria coluna, sem precisar da divisão entre `total.averages` e
     * `summary` que o PDF exige.
     */
    total?: {
      /** Texto da primeira célula, ex.: "Total geral". */
      label: string;
      values: { column: string; field: string; format?: 'number' | 'duration' | 'duration_hours' }[];
    };
  };
};

/**
 * ⚠️ **Um nível só** - este arquivo compila para `dist/reports/`, então
 * `__dirname/..` já é o `dist`. Subir dois escapa dele e cai na pasta do
 * projeto, que não existe dentro do container. Ver a nota maior em
 * `report-pdf.service.ts`.
 */
const PASTA_TEMPLATES = path.join(__dirname, '..', 'templates', 'reports');

/**
 * Carrega os templates de relatório de `templates/reports/*.report.json`.
 *
 * **Por que os relatórios são descritos em JSON e não em código:** hoje são
 * poucos, mas a lista cresce, e com dezenas deles o layout espalhado pelo
 * código vira caça ao tesouro na hora da manutenção. Com o template, mexer
 * numa coluna - largura, ordem, título, texto de célula vazia - é abrir um
 * arquivo que mostra a estrutura inteira do relatório de uma vez, sem
 * recompilar nem fazer deploy.
 *
 * O que **não** vive no template: a consulta ao banco (`reports.service.ts`,
 * porque SQL vindo de arquivo editável seria outra história) e a identidade
 * visual compartilhada (`report.layout.json`).
 */
@Injectable()
export class ReportTemplateService {
  private readonly logger = new Logger(ReportTemplateService.name);

  /**
   * Os templates já lidos. Em produção o arquivo não muda sem deploy, então
   * reler a cada requisição só custaria I/O; em desenvolvimento o cache é
   * limpo pelo restart, que é como o resto do backend já funciona.
   */
  private readonly cache = new Map<string, TemplateDoRelatorio>();

  carregar(nome: string): TemplateDoRelatorio {
    const emCache = this.cache.get(nome);
    if (emCache) return emCache;

    const arquivo = path.join(PASTA_TEMPLATES, `${nome}.report.json`);

    try {
      const template = JSON.parse(fs.readFileSync(arquivo, 'utf-8')) as TemplateDoRelatorio;
      this.cache.set(nome, template);
      return template;
    } catch (erro) {
      // Mensagem explícita: template ausente ou com JSON inválido é erro de
      // deploy, e o log precisa dizer qual arquivo abrir.
      this.logger.error(`Falha ao ler o template ${arquivo}: ${erro?.message ?? erro}`);
      throw new InternalServerErrorException('Modelo do relatório indisponível');
    }
  }

  /** As colunas do PDF, com os formatadores já aplicados. */
  colunasDoPdf<T>(template: TemplateDoRelatorio): ReportColumn<T>[] {
    return template.pdf.columns.map((coluna) => ({
      titulo: coluna.title,
      largura: coluna.width,
      alinhamento: coluna.align,
      textoVazio: coluna.empty,
      valor: (linha: T) => this.formataParaTexto(linha?.[coluna.field], coluna.format),
    }));
  }

  /**
   * O rodapé da tabela do PDF, a partir dos totais da consulta.
   *
   * O texto da primeira célula vem do próprio template (`total.label`), não
   * de parâmetro passado pelo controller - nada da aparência do relatório
   * deve exigir tocar em código para mudar uma palavra.
   */
  totalDoPdf(template: TemplateDoRelatorio, totais: Record<string, unknown>): ReportTotal | undefined {
    const total = template.pdf.total;
    if (!total) return undefined;

    // As médias apontam para a coluna pelo **título**, não pelo índice:
    // reordenar colunas no template não deveria mudar onde o número aparece.
    const valores = (total.averages ?? []).map((media) => ({
      indiceDaColuna: template.pdf.columns.findIndex((c) => c.title === media.column),
      valor:
        media.format === 'number'
          ? String(totais[media.field] ?? 0)
          : media.format === 'duration_hours'
            ? duracaoEmHoras(totais[media.field] as number) || '-'
            : duracaoCompacta(totais[media.field] as number) || '-',
      rotulo: media.label,
    }));

    return {
      resumo: total.label ?? '',
      colunasDoResumo: total.summaryColumns,
      // Coluna removida do template sem tirar a média correspondente: ignora,
      // em vez de pintar o número na primeira coluna (o que `-1` faria).
      valores: valores.filter((v) => v.indiceDaColuna >= 0),
    };
  }

  /**
   * A caixa de resumo depois da tabela (ver `resumoFinal` em
   * `report-pdf.service.ts` e `escreveResumoFinal` em
   * `report-excel.service.ts`), a partir da seção `pdf.summary` do template -
   * usada tanto pelo PDF quanto pelo Excel, que mostram a mesma caixa.
   *
   * Mesmo raciocínio de `totalDoPdf`: os pares rótulo/valor vêm do arquivo,
   * não de texto escrito no controller - um relatório novo não deveria exigir
   * tocar em código só para dizer "mostre também o total de X".
   */
  resumoFinal(
    template: TemplateDoRelatorio,
    totais: Record<string, unknown>,
  ): { titulo: string; itens: { rotulo: string; valor: string }[] } | undefined {
    const summary = template.pdf.summary;
    if (!summary) return undefined;

    return {
      titulo: summary.title,
      itens: summary.items.map((item) => ({
        rotulo: item.label,
        valor:
          item.format === 'duration'
            ? duracaoCompacta(totais[item.field] as number) || '-'
            : item.format === 'duration_hours'
              ? duracaoEmHoras(totais[item.field] as number) || '-'
              : String(totais[item.field] ?? 0),
      })),
    };
  }

  /**
   * As colunas do Excel, preservando tipo (data/número) para o arquivo somar.
   *
   * Sem largura: o `ReportExcelService` calcula pelo conteúdo real de cada
   * coluna - um número fixo no template tanto corta texto comprido quanto
   * desperdiça espaço com texto curto.
   */
  colunasDoExcel<T>(template: TemplateDoRelatorio): ExcelColumn<T>[] {
    return template.excel.columns.map((coluna) => ({
      titulo: coluna.title,
      formato: coluna.type ? coluna.format : undefined,
      alinhamento: coluna.align,
      valor: (linha: T) => this.valorParaExcel(linha?.[coluna.field], coluna),
    }));
  }

  /**
   * A linha de totais do Excel, a partir da seção `excel.total` do template -
   * mesmo raciocínio do PDF: o rótulo e os campos vêm do arquivo, não de
   * texto escrito no controller.
   */
  totalDoExcel(
    template: TemplateDoRelatorio,
    totais: Record<string, unknown>,
  ): { rotulo: string; porColuna: { coluna: string; valor: string | number }[] } | undefined {
    const total = template.excel.total;
    if (!total) return undefined;

    return {
      rotulo: total.label,
      porColuna: total.values.map((item) => ({
        coluna: item.column,
        valor:
          item.format === 'duration'
            ? duracaoCompacta(totais[item.field] as number) || '-'
            : item.format === 'duration_hours'
              ? duracaoEmHoras(totais[item.field] as number) || '-'
              : Number(totais[item.field] ?? 0),
      })),
    };
  }

  private formataParaTexto(valor: unknown, formato?: string): string | null {
    if (valor === null || valor === undefined) return null;

    if (formato === 'duration') return duracaoCompacta(valor as number) || null;
    if (formato === 'duration_hours') return duracaoEmHoras(valor as number) || null;
    if (formato === 'shortDateTime') return this.dataHoraCurta(valor as string);

    return String(valor);
  }

  private valorParaExcel(
    valor: unknown,
    coluna: ColunaDoTemplate,
  ): string | number | Date | null {
    // Nulo fica **vazio de verdade**, sem travessão: ao contrário do PDF, aqui
    // um texto no lugar do nada atrapalha soma, filtro e ordenação.
    if (valor === null || valor === undefined) return null;

    if (coluna.type === 'date') return new Date(valor as string);
    if (coluna.type === 'number') return Number(valor);
    if (coluna.format === 'duration') return duracaoCompacta(valor as number) || null;
    if (coluna.format === 'duration_hours') return duracaoEmHoras(valor as number) || null;

    return String(valor);
  }

  /** `15/10, 23:04` no fuso de exibição. */
  private dataHoraCurta(data: string): string | null {
    if (!data) return null;

    return new Date(data).toLocaleString('pt-BR', {
      timeZone: FUSO_EXIBICAO,
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
