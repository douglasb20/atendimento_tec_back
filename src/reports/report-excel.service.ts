import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';

/**
 * Uma coluna da planilha.
 *
 * Diferente da coluna do PDF, aqui `valor` pode devolver **número ou data**,
 * não só texto: o Excel existe para somar, ordenar e fazer gráfico, e isso só
 * funciona se a célula guardar o tipo certo. Uma duração gravada como
 * "1h 20min" é texto, e texto não soma.
 */
export type ExcelColumn<T> = {
  titulo: string;
  valor: (linha: T) => string | number | Date | null;
  /** Formato do Excel, ex.: `dd/mm/yyyy hh:mm` ou `0`. */
  formato?: string;
  /**
   * Alinhamento do conteúdo. Sem isto, o Excel alinha `number`/`Date` à
   * direita e texto à esquerda sozinho - mas uma duração como "3h 35min" é
   * texto (para não quebrar quando a coluna também tem a versão em segundos),
   * e ficava torta ao lado de colunas numéricas de verdade.
   */
  alinhamento?: 'left' | 'right' | 'center';
};

export type ExcelReportData<T> = {
  /** Nome da aba e do arquivo. */
  titulo: string;
  periodo: string;
  filtros: { rotulo: string; valor: string }[];
  colunas: ExcelColumn<T>[];
  linhas: T[];
  geradoPor: string;
  /**
   * A linha de totais, no fim da tabela - rótulo na primeira coluna e um
   * valor por campo, pelo **título** da coluna (igual às médias do PDF:
   * reordenar colunas no template não deveria mudar onde o número cai).
   */
  totais?: { rotulo: string; porColuna: { coluna: string; valor: string | number }[] };
  /**
   * A caixa de resumo depois da tabela (mesmo dado de `resumoFinal` do PDF) -
   * para contagens sem coluna correspondente, como "9 atendimentos", que não
   * são soma de nenhuma coluna da tabela.
   */
  resumoFinal?: { titulo: string; itens: { rotulo: string; valor: string }[] };
};

const MARINHO = 'FF000459';

@Injectable()
export class ReportExcelService {
  async gerar<T>(dados: ExcelReportData<T>): Promise<Buffer> {
    const workbook = new Workbook();
    workbook.creator = 'Automatec Sistemas';
    workbook.created = new Date();

    // O nome da aba não aceita : \ / ? * [ ] e tem teto de 31 caracteres - o
    // Excel recusa o arquivo inteiro se passar, sem dizer o motivo.
    const aba = workbook.addWorksheet(dados.titulo.replace(/[:\\/?*[\]]/g, '').slice(0, 31));

    const linhaDoCabecalho = this.escreveIdentificacao(aba, dados);
    const linhaAposTabela = this.escreveTabela(aba, dados, linhaDoCabecalho);
    this.escreveResumoFinal(aba, dados.resumoFinal, linhaAposTabela);

    // Dois passos até `Buffer`: o exceljs declara o retorno com um `Buffer`
    // próprio, que o TypeScript não reconhece como o do Node.
    return (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
  }

  /**
   * Título, período e filtros acima da tabela.
   *
   * Vão na planilha pelo mesmo motivo do PDF: o arquivo circula solto, e sem
   * isso ninguém sabe de que recorte ele é. Devolve a linha em que a tabela
   * deve começar.
   */
  private escreveIdentificacao<T>(
    aba: ReturnType<Workbook['addWorksheet']>,
    dados: ExcelReportData<T>,
  ): number {
    const titulo = aba.getCell('A1');
    titulo.value = dados.titulo;
    titulo.font = { bold: true, size: 14, color: { argb: MARINHO } };

    aba.getCell('A2').value = `Período: ${dados.periodo}`;
    aba.getCell('A3').value = dados.geradoPor;

    let linha = 4;

    if (dados.filtros.length) {
      linha += 1;
      for (const filtro of dados.filtros) {
        const celula = aba.getCell(`A${linha}`);
        celula.value = `${filtro.rotulo}: ${filtro.valor}`;
        celula.font = { size: 10 };
        linha += 1;
      }
    }

    // Uma linha em branco separando a identificação da tabela.
    return linha + 1;
  }

  /** Devolve a primeira linha livre depois da tabela (e do total, se houver). */
  private escreveTabela<T>(
    aba: ReturnType<Workbook['addWorksheet']>,
    dados: ExcelReportData<T>,
    linhaDoCabecalho: number,
  ): number {
    const { colunas, linhas, totais } = dados;

    const cabecalho = aba.getRow(linhaDoCabecalho);
    colunas.forEach((coluna, indice) => {
      const celula = cabecalho.getCell(indice + 1);
      celula.value = coluna.titulo;
      celula.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MARINHO } };
      celula.alignment = { vertical: 'middle' };
    });
    cabecalho.height = 20;

    // A largura de cada coluna acompanha o maior texto nela (título incluso),
    // em vez de um número fixo no template: um valor fixo tanto corta
    // conteúdo comprido quanto desperdiça espaço com conteúdo curto, e cada
    // relatório tem textos de tamanhos bem diferentes.
    //
    // A medição usa o texto **formatado** (`numFmt`), não o valor cru: uma
    // `Date` com `dd/mm/yyyy hh:mm` ocupa mais que a data sozinha, e medir só
    // a data fazia a coluna ficar estreita demais - o Excel mostra `###` na
    // célula inteira quando o número formatado não cabe.
    const maiorTexto = colunas.map((coluna) => coluna.titulo.length);

    linhas.forEach((linha, indiceDaLinha) => {
      const linhaDaPlanilha = aba.getRow(linhaDoCabecalho + 1 + indiceDaLinha);

      colunas.forEach((coluna, indiceDaColuna) => {
        const celula = linhaDaPlanilha.getCell(indiceDaColuna + 1);
        const valor = coluna.valor(linha);

        // Nulo fica **vazio de verdade**, sem travessão: ao contrário do PDF,
        // aqui um texto no lugar do nada atrapalharia soma, filtro e
        // ordenação da coluna.
        if (valor !== null) celula.value = valor;
        if (coluna.formato) celula.numFmt = coluna.formato;
        if (coluna.alinhamento) celula.alignment = { horizontal: coluna.alinhamento };

        maiorTexto[indiceDaColuna] = Math.max(
          maiorTexto[indiceDaColuna],
          this.paraTextoFormatado(valor, coluna.formato).length,
        );
      });
    });

    let linhaDoTotal: number | undefined;

    if (totais) {
      linhaDoTotal = linhaDoCabecalho + 1 + linhas.length;
      const linhaDaPlanilha = aba.getRow(linhaDoTotal);

      const rotulo = linhaDaPlanilha.getCell(1);
      rotulo.value = totais.rotulo;
      rotulo.font = { bold: true, color: { argb: MARINHO } };
      maiorTexto[0] = Math.max(maiorTexto[0], this.paraTexto(totais.rotulo).length);

      for (const item of totais.porColuna) {
        const indice = colunas.findIndex((c) => c.titulo === item.coluna);
        // Coluna removida do template sem tirar o total correspondente:
        // ignora, em vez de pintar o número na primeira coluna.
        if (indice < 0) continue;

        const celula = linhaDaPlanilha.getCell(indice + 1);
        celula.value = item.valor;
        celula.font = { bold: true, color: { argb: MARINHO } };
        if (colunas[indice].formato) celula.numFmt = colunas[indice].formato;
        if (colunas[indice].alinhamento) {
          celula.alignment = { horizontal: colunas[indice].alinhamento };
        }

        maiorTexto[indice] = Math.max(
          maiorTexto[indice],
          this.paraTextoFormatado(item.valor, colunas[indice].formato).length,
        );
      }
    }

    colunas.forEach((_coluna, indice) => {
      // +4: a folga que o Excel dá sozinho no autofit do botão
      // "Ajustar largura da coluna", senão o texto encosta na borda.
      aba.getColumn(indice + 1).width = maiorTexto[indice] + 4;
    });

    // Autofiltro só sobre as linhas de dados - a linha de total não é dado
    // filtrável, e incluí-la faria um filtro por valor escondê-la junto.
    if (linhas.length) {
      aba.autoFilter = {
        from: { row: linhaDoCabecalho, column: 1 },
        to: { row: linhaDoCabecalho + linhas.length, column: colunas.length },
      };
    }

    // +1 de novo: uma linha em branco separando a tabela da caixa de resumo,
    // mesma folga usada entre a identificação e a tabela.
    return (linhaDoTotal ?? linhaDoCabecalho + linhas.length) + 2;
  }

  /**
   * A caixa de resumo depois da tabela - cabeçalho igual ao da tabela
   * principal e uma linha por métrica, rótulo e valor em negrito.
   *
   * Mesma ideia de `resumoFinal` no PDF: existe para contagens que não são
   * soma de nenhuma coluna da tabela (ex.: "9 atendimentos" não é a soma de
   * "Protocolo").
   */
  private escreveResumoFinal(
    aba: ReturnType<Workbook['addWorksheet']>,
    resumo: { titulo: string; itens: { rotulo: string; valor: string }[] } | undefined,
    linhaInicial: number,
  ): void {
    if (!resumo?.itens.length) return;

    const cabecalho = aba.getRow(linhaInicial);
    const celulaTitulo = cabecalho.getCell(1);
    celulaTitulo.value = resumo.titulo;
    celulaTitulo.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    celulaTitulo.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: MARINHO } };
    aba.mergeCells(linhaInicial, 1, linhaInicial, 2);

    resumo.itens.forEach((item, indice) => {
      const linha = aba.getRow(linhaInicial + 1 + indice);

      const rotulo = linha.getCell(1);
      rotulo.value = item.rotulo;
      rotulo.font = { color: { argb: '666666' } };

      const valor = linha.getCell(2);
      valor.value = item.valor;
      valor.font = { bold: true, color: { argb: MARINHO } };
      valor.alignment = { horizontal: 'right' };
    });
  }

  private paraTexto(valor: unknown): string {
    if (valor === null || valor === undefined) return '';
    if (valor instanceof Date) return valor.toLocaleDateString('pt-BR');
    return String(valor);
  }

  /**
   * O texto que a célula vai **exibir**, respeitando o `numFmt` - usado só
   * para medir a largura da coluna, nunca para gravar valor (quem grava é
   * `celula.value`, com o tipo certo para o Excel somar/ordenar).
   *
   * Uma `Date` sem o formato em conta mede só "17/10/2026", mas a célula com
   * `dd/mm/yyyy hh:mm` mostra também a hora - subestimar isso é exatamente o
   * que fazia o Excel exibir `###` na coluna.
   */
  private paraTextoFormatado(valor: unknown, formato?: string): string {
    if (valor === null || valor === undefined) return '';

    if (valor instanceof Date) {
      // Só os dois formatos usados nos templates hoje - um `numFmt`
      // arbitrário exigiria um parser completo, que não compensa para medir
      // largura de coluna.
      if (formato?.includes('hh:mm')) {
        return valor.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
      }
      return valor.toLocaleDateString('pt-BR');
    }

    return String(valor);
  }
}
