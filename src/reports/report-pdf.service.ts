import { Injectable } from '@nestjs/common';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';

// O `@types/pdfmake` descreve a build de **navegador** (`createPdf`), que não
// tem o printer de servidor - este sai do require, sem tipagem.
//
// ⚠️ Fixado na **0.2.x**, não na 0.3: naquela o `createPdfKitDocument` devolve
// `Promise` e exige um `urlResolver` que a API não documenta, e o printer
// mudou de lugar (`js/Printer`, com `.default`). A 0.2 é a estável.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake');
import * as path from 'node:path';
import * as fs from 'node:fs';

/** Uma coluna do relatório, na ordem em que aparece. */
export type ReportColumn<T> = {
  titulo: string;
  /** O texto da célula. Nulo/vazio vira o `textoVazio`, nunca célula em branco. */
  valor: (linha: T) => string | null;
  /** Largura relativa (`*`), fixa em pontos, ou `auto`. */
  largura?: string | number;
  alinhamento?: 'left' | 'right' | 'center';
  /** O que mostrar quando `valor` devolve nulo. Em itálico cinza. */
  textoVazio?: string;
};

/** O rodapé da tabela: um texto no começo e valores sob colunas específicas. */
export type ReportTotal = {
  /** Texto da primeira célula, que ocupa as colunas iniciais. */
  resumo: string;
  /** Complemento em cinza, na mesma célula. */
  detalhe?: string;
  /** Quantas colunas o `resumo` ocupa. */
  colunasDoResumo: number;
  /** Valor sob uma coluna, pelo índice dela. */
  valores?: { indiceDaColuna: number; valor: string; rotulo?: string }[];
};

export type PdfReportData<T> = {
  titulo: string;
  /** "30/09/2026 a 16/10/2026", já formatado. */
  periodo: string;
  /** "últimos 15 dias" ou vazio quando o período é personalizado. */
  descricaoDoPeriodo?: string;
  /** Os filtros aplicados, em pares rótulo/valor. */
  filtros: { rotulo: string; valor: string }[];
  colunas: ReportColumn<T>[];
  linhas: T[];
  total?: ReportTotal;
  /**
   * O resumo do período, numa caixa compacta depois da tabela - um
   * cabeçalho igual ao da tabela principal e uma linha por métrica, rótulo à
   * esquerda e valor à direita, separadas por um traço na cor `textMuted`.
   *
   * Existe para relatórios cujos totais não correspondem a nenhuma coluna da
   * própria tabela (ex.: "9 atendimentos" não é a soma de uma coluna
   * "Protocolo") - usar `total.valores` ali ficaria arbitrário. Quando a
   * tabela já tem a coluna que o total representa (ex.: produtividade, onde
   * "Total" já é uma coluna), o lugar certo continua sendo `total`, não isto.
   */
  resumoFinal?: { titulo: string; itens: { rotulo: string; valor: string }[] };
  geradoPor: string;
};

/**
 * O layout padrão dos relatórios, lido de
 * `templates/reports/report.layout.json`.
 *
 * É o papel que o `.jrxml` cumpre no Jasper: descreve a aparência, enquanto
 * este service é o motor que desenha. Vale para **todos** os relatórios -
 * página, cabeçalho, cores, tipografia e tabela; o corpo de cada um fica no
 * `<nome>.report.json`.
 */
type LayoutDoRelatorio = {
  page: {
    size: string;
    orientation: 'portrait' | 'landscape';
    margins: { left: number; top: number; right: number; bottom: number };
  };
  colors: {
    brand: string;
    text: string;
    textMuted: string;
    line: string;
    stripe: string;
    empty: string;
  };
  fonts: {
    family: string;
    body: number;
    default: number;
    reportTitle: number;
    tableHeader: number;
    footer: number;
    totalLabel: number;
  };
  header: {
    showLogo: boolean;
    logo: string;
    logoHeight: number;
    logoWidth: number;
    logoAlign: 'left' | 'center' | 'right';
    fallbackText: string;
    showTitle: boolean;
    titleAlign: 'left' | 'center' | 'right';
    showPeriod: boolean;
    subtitle: string;
    showRule: boolean;
    ruleWidth: number;
    ruleLength: number;
    marginTop: number;
  };
  filters: { columns: number; marginBottom: number };
  table: {
    padding: { top: number; bottom: number; left: number; right: number };
    lineWidth: number;
    lineWidthBeforeTotal: number;
  };
};

/**
 * Onde o `nest-cli.json` deixa os `templates/` depois do build.
 *
 * ⚠️ **Um nível só.** Este arquivo compila para `dist/reports/`, então
 * `__dirname/..` já é o `dist`. O `configmailer.module.ts` sobe dois porque
 * está em `dist/core/mailer/` - copiar o caminho dele daqui escapa do `dist`
 * e cai em `back/templates`, a pasta do projeto. Em desenvolvimento isso
 * passa despercebido (as duas existem e têm o mesmo conteúdo); dentro do
 * container, onde só o `dist` é copiado, o arquivo some.
 *
 * Derivado de `__dirname` e **não** de `process.cwd()` - a armadilha
 * documentada no mailer: com `cwd` o caminho quebra em produção, onde o
 * processo não roda da raiz do projeto.
 */
const PASTA_TEMPLATES = path.join(__dirname, '..', 'templates');

@Injectable()
export class ReportPdfService {
  /**
   * O layout, lido do disco uma vez por instância (o service é singleton).
   *
   * Lido, e não importado: `import` de JSON é resolvido em tempo de
   * compilação e o arquivo viraria código, perdendo a razão de ser externo.
   */
  private readonly layout: LayoutDoRelatorio = JSON.parse(
    fs.readFileSync(path.join(PASTA_TEMPLATES, 'reports', 'report.layout.json'), 'utf-8'),
  );

  /**
   * As fontes vivem em `templates/reports/fonts/`, extraídas uma vez do
   * `vfs_fonts.js` do pdfmake (ver o README de lá).
   *
   * A 0.2 não distribui os `.ttf` soltos - só o `vfs_fonts.js`, que é o
   * empacotamento para navegador e traz ~2 MB de base64. Passá-lo ao printer
   * não funcionou em nenhuma das formas documentadas; o caminho de arquivo
   * funciona, e de quebra as fontes seguem o mesmo trajeto da logo até a
   * imagem de produção (`nest-cli.json` copia `templates/**` para `dist`).
   */
  private readonly printer = new PdfPrinter({
    Roboto: {
      normal: this.caminhoDaFonte('Roboto-Regular.ttf'),
      bold: this.caminhoDaFonte('Roboto-Medium.ttf'),
      italics: this.caminhoDaFonte('Roboto-Italic.ttf'),
      bolditalics: this.caminhoDaFonte('Roboto-MediumItalic.ttf'),
    },
  });

  /**
   * Gera o PDF inteiro em memória.
   *
   * Em memória, e não em stream para o cliente: o relatório é recortado por
   * período e cabe nisso com folga, e assim uma falha no meio da geração vira
   * um erro HTTP limpo em vez de um arquivo truncado que o leitor de PDF
   * recusa abrir sem explicação.
   */
  async gerar<T>(dados: PdfReportData<T>): Promise<Buffer> {
    const definicao = this.montaDocumento(dados);
    const pdf = this.printer.createPdfKitDocument(definicao);

    return new Promise((resolve, reject) => {
      const pedacos: Buffer[] = [];
      pdf.on('data', (pedaco: Buffer) => pedacos.push(pedaco));
      pdf.on('end', () => resolve(Buffer.concat(pedacos)));
      pdf.on('error', reject);
      pdf.end();
    });
  }

  private montaDocumento<T>(dados: PdfReportData<T>): TDocumentDefinitions {
    return {
      // Tudo de `templates/reports/report.layout.json`: página, margens e
      // tipografia são aparência, e aparência mora lá.
      pageSize: this.layout.page.size as TDocumentDefinitions['pageSize'],
      pageOrientation: this.layout.page.orientation,
      pageMargins: [
        this.layout.page.margins.left,
        this.layout.page.margins.top,
        this.layout.page.margins.right,
        this.layout.page.margins.bottom,
      ],

      defaultStyle: {
        font: this.layout.fonts.family,
        fontSize: this.layout.fonts.default,
        color: this.layout.colors.text,
      },

      header: () => this.cabecalho(dados),
      footer: (paginaAtual, totalPaginas) =>
        this.rodape(dados.geradoPor, paginaAtual, totalPaginas),

      content: [
        ...this.filtros(dados.filtros),
        this.tabela(dados),
        ...this.resumoFinal(dados.resumoFinal),
      ],
    };
  }

  /**
   * Cabeçalho comum a todos os relatórios: marca à esquerda, título e período
   * à direita, régua marinho embaixo.
   *
   * Repetido em toda página porque um relatório longo impresso costuma ser
   * lido em folhas separadas - sem isso, a partir da segunda página ninguém
   * sabe do que se trata nem de que período.
   */
  private cabecalho<T>(dados: PdfReportData<T>): Content {
    const cfg = this.layout.header;

    // `any` nos blocos: a tipagem de `Content` admite array, e o TypeScript
    // recusa espalhar (`...`) um tipo que pode ser array - o arranjo em
    // colunas abaixo precisa disso. A conversão acontece uma vez, na saída.
    const blocos: any[] = [];

    const marca = cfg.showLogo ? this.marca() : null;
    const titulo = cfg.showTitle ? this.tituloDoCabecalho(dados) : null;

    // Três arranjos possíveis, e cada um precisa de uma montagem diferente -
    // `columns` do pdfmake não resolve os três sozinho.
    if (cfg.logoAlign === 'center') {
      // Empilhados: a logo centralizada e o título embaixo, cada um com seu
      // próprio alinhamento (o `alignment` precisa ir em cada bloco, porque
      // `stack` não o propaga aos filhos).
      if (marca) blocos.push({ ...marca, alignment: 'center' });
      if (titulo) blocos.push({ ...titulo, alignment: cfg.titleAlign });
    } else if (marca && titulo) {
      // Os dois na mesma linha, em lados opostos. Só o segundo leva
      // `width: '*'`: é ele que ocupa o espaço restante e empurra o próprio
      // conteúdo para a borda, em vez de os dois ficarem colados à esquerda.
      const invertido = cfg.logoAlign === 'right';

      blocos.push({
        columns: invertido
          ? [{ ...titulo, alignment: cfg.titleAlign }, { width: '*', ...marca, alignment: 'right' }]
          : [marca, { width: '*', ...titulo, alignment: cfg.titleAlign }],
      });
    } else if (marca || titulo) {
      // Só um deles: vai sozinho, sem coluna vazia ao lado - ela roubaria
      // metade da linha e o `titleAlign` não teria efeito nenhum.
      const unico = marca ?? titulo;
      blocos.push({ ...unico, alignment: marca ? cfg.logoAlign : cfg.titleAlign });
    }

    if (cfg.showRule) {
      // Linha desenhada no canvas, e não borda: borda exigiria envolver o
      // cabeçalho inteiro numa tabela, por um traço só.
      blocos.push({
        canvas: [
          {
            type: 'line',
            x1: 0,
            y1: 6,
            x2: cfg.ruleLength,
            y2: 6,
            lineWidth: cfg.ruleWidth,
            lineColor: this.layout.colors.brand,
          },
        ],
      });
    }

    return {
      margin: [this.layout.page.margins.left, cfg.marginTop, this.layout.page.margins.right, 0],
      stack: blocos,
    };
  }

  /** A logo, ou o nome em texto quando o arquivo não está lá. */
  private marca(): Record<string, unknown> {
    const logo = path.join(PASTA_TEMPLATES, 'reports', this.layout.header.logo);

    if (fs.existsSync(logo)) {
      return {
        image: logo,
        height: this.layout.header.logoHeight,
        width: this.layout.header.logoWidth,
      };
    }

    // Sem a imagem o relatório sai assim mesmo: faltar a marca não é motivo
    // para negar o relatório a quem o pediu.
    return {
      text: this.layout.header.fallbackText,
      bold: true,
      fontSize: this.layout.fonts.reportTitle,
      color: this.layout.colors.brand,
    };
  }

  /** Título, subtítulo opcional e o período. */
  private tituloDoCabecalho<T>(dados: PdfReportData<T>): Record<string, unknown> {
    const cfg = this.layout.header;
    const linhas: Content[] = [
      {
        text: dados.titulo,
        bold: true,
        fontSize: this.layout.fonts.reportTitle,
        color: this.layout.colors.brand,
      },
    ];

    if (cfg.subtitle) {
      linhas.push({
        text: cfg.subtitle,
        fontSize: this.layout.fonts.default,
        color: this.layout.colors.textMuted,
        margin: [0, 2, 0, 0],
      });
    }

    if (cfg.showPeriod) {
      linhas.push({
        text: dados.descricaoDoPeriodo
          ? `${dados.periodo}  ·  ${dados.descricaoDoPeriodo}`
          : dados.periodo,
        fontSize: this.layout.fonts.default,
        color: this.layout.colors.textMuted,
        margin: [0, 2, 0, 0],
      });
    }

    return { stack: linhas };
  }

  /**
   * Os filtros aplicados, em três colunas.
   *
   * Não é enfeite: o PDF circula por e-mail, e sem isto quem o recebe não tem
   * como saber se é de um atendente ou de todos, de um setor ou da operação
   * inteira.
   */
  private filtros(filtros: { rotulo: string; valor: string }[]): Content[] {
    if (!filtros.length) return [];

    const COLUNAS = this.layout.filters.columns;
    const linhas: Content[][] = [];

    for (let i = 0; i < filtros.length; i += COLUNAS) {
      const fatia = filtros.slice(i, i + COLUNAS);

      linhas.push(
        // Preenche a última linha até fechar as três colunas: o layout de
        // tabela do pdfmake exige o mesmo número de células em toda linha.
        Array.from({ length: COLUNAS }, (_, coluna) => {
          const filtro = fatia[coluna];
          if (!filtro) return { text: '' };

          return {
            text: [
              { text: `${filtro.rotulo}: `, bold: true, color: this.layout.colors.brand },
              { text: filtro.valor },
            ],
            fontSize: this.layout.fonts.default,
          };
        }),
      );
    }

    return [
      {
        table: { widths: ['*', '*', '*'], body: linhas },
        layout: 'noBorders',
        margin: [0, 0, 0, this.layout.filters.marginBottom],
      },
    ];
  }

  private tabela<T>(dados: PdfReportData<T>): Content {
    const { colunas, linhas, total } = dados;

    const cabecalho: Content[] = colunas.map((coluna) => ({
      text: coluna.titulo.toUpperCase(),
      bold: true,
      fontSize: this.layout.fonts.tableHeader,
      color: '#ffffff',
      alignment: coluna.alinhamento ?? 'left',
      margin: [0, 3, 0, 3],
    }));

    const corpo: Content[][] = linhas.map((linha) =>
      colunas.map((coluna) => {
        const valor = coluna.valor(linha);

        // Vazio escrito por extenso, em itálico cinza: célula em branco num
        // PDF deixa a dúvida entre "não tem" e "o sistema falhou".
        if (valor === null || valor === '') {
          return {
            text: coluna.textoVazio ?? '-',
            italics: Boolean(coluna.textoVazio),
            color: this.layout.colors.empty,
            alignment: coluna.alinhamento ?? 'left',
            fontSize: this.layout.fonts.body,
          };
        }

        return {
          text: valor,
          alignment: coluna.alinhamento ?? 'left',
          fontSize: this.layout.fonts.body,
        };
      }),
    );

    const rodapeDaTabela = total ? [this.linhaDeTotal(colunas, total)] : [];

    return {
      table: {
        // A primeira linha se repete no topo de cada página: sem isso, a
        // segunda folha de um relatório longo é uma grade de números sem
        // nenhum título de coluna.
        headerRows: 1,
        widths: colunas.map((coluna) => coluna.largura ?? '*'),
        body: [cabecalho, ...corpo, ...rodapeDaTabela],
      },
      layout: {
        hLineWidth: (i, node) => {
          const ultimaDeDados = node.table.body.length - (total ? 2 : 1);
          if (i === 0 || i === 1) return 0; // o cabeçalho tem fundo próprio
          if (i === ultimaDeDados + 1) return this.layout.table.lineWidthBeforeTotal;
          return this.layout.table.lineWidth;
        },
        vLineWidth: () => 0,
        hLineColor: (i, node) => {
          const ultimaDeDados = node.table.body.length - (total ? 2 : 1);
          return i === ultimaDeDados + 1 ? this.layout.colors.brand : this.layout.colors.line;
        },
        fillColor: (indiceDaLinha, node) => {
          if (indiceDaLinha === 0) return this.layout.colors.brand;
          if (total && indiceDaLinha === node.table.body.length - 1) return null;
          // Zebra a partir da primeira linha de dados.
          return indiceDaLinha % 2 === 0 ? this.layout.colors.stripe : null;
        },
        paddingTop: () => this.layout.table.padding.top,
        paddingBottom: () => this.layout.table.padding.bottom,
        paddingLeft: () => this.layout.table.padding.left,
        paddingRight: () => this.layout.table.padding.right,
      },
    };
  }

  private linhaDeTotal<T>(colunas: ReportColumn<T>[], total: ReportTotal): Content[] {
    // `any` na célula: `colSpan` é propriedade de célula de tabela, que a
    // tipagem de `Content` não cobre - ela descreve o conteúdo do documento,
    // não o da grade.
    const celulas: any[] = [];

    celulas.push({
      text: [
        { text: total.resumo, bold: true, color: this.layout.colors.brand },
        ...(total.detalhe
          ? [{ text: `   ·   ${total.detalhe}`, color: this.layout.colors.textMuted }]
          : []),
      ],
      colSpan: total.colunasDoResumo,
      fontSize: this.layout.fonts.default,
    });

    // O `colSpan` do pdfmake exige as células seguintes presentes e vazias.
    for (let i = 1; i < total.colunasDoResumo; i += 1) celulas.push({ text: '' });

    for (let i = total.colunasDoResumo; i < colunas.length; i += 1) {
      const valor = total.valores?.find((v) => v.indiceDaColuna === i);

      celulas.push(
        valor
          ? {
              stack: [
                {
                  text: valor.valor,
                  bold: true,
                  color: this.layout.colors.brand,
                  fontSize: this.layout.fonts.default,
                },
                ...(valor.rotulo
                  ? [
                      {
                        text: valor.rotulo,
                        color: this.layout.colors.textMuted,
                        fontSize: this.layout.fonts.totalLabel,
                      },
                    ]
                  : []),
              ],
              alignment: colunas[i].alinhamento ?? 'left',
            }
          : { text: '' },
      );
    }

    return celulas;
  }

  /**
   * O resumo do período, numa caixa compacta depois da tabela: cabeçalho
   * igual ao da tabela principal (fundo marinho, texto branco), e uma linha
   * por métrica - rótulo à esquerda, valor em negrito à direita, com um
   * traço inferior na cor `textMuted` separando cada linha.
   *
   * Existe para as contagens que não são soma de nenhuma coluna da tabela
   * (ex.: "9 atendimentos" não é a soma de "Protocolo") - colocá-las na linha
   * de total da tabela, como `ReportTotal.valores` faz com Espera/Duração,
   * seria arbitrário sem uma coluna que justifique a posição.
   */
  private resumoFinal(resumo?: { titulo: string; itens: { rotulo: string; valor: string }[] }): Content[] {
    if (!resumo?.itens.length) return [];

    const cabecalho: any[] = [
      {
        text: resumo.titulo.toUpperCase(),
        bold: true,
        fontSize: this.layout.fonts.tableHeader,
        color: '#ffffff',
        colSpan: 2,
        margin: [0, 3, 0, 3],
      },
      {},
    ];

    const linhas: any[][] = resumo.itens.map((item) => [
      { text: item.rotulo, color: this.layout.colors.textMuted, fontSize: this.layout.fonts.default },
      {
        text: item.valor,
        bold: true,
        color: this.layout.colors.brand,
        fontSize: this.layout.fonts.default,
        alignment: 'right',
      },
    ]);

    return [
      {
        // Largura fixa, colada à **esquerda**: a tabela principal também
        // começa ali, então o resumo fica alinhado com ela em vez de isolado
        // do lado oposto da página.
        table: { widths: [140, 60], body: [cabecalho, ...linhas] },
        layout: {
          hLineWidth: (i: number) => (i === 0 || i === 1 ? 0 : this.layout.table.lineWidth),
          vLineWidth: () => 0,
          // Mesma cor e espessura do traço entre linhas da tabela principal
          // (`colors.line`) - um traço discreto, não o cinza mais escuro do
          // texto (`textMuted`), que chamava atenção demais numa caixa pequena.
          hLineColor: () => this.layout.colors.line,
          fillColor: (i: number) => (i === 0 ? this.layout.colors.brand : null),
          paddingTop: () => 3,
          paddingBottom: () => 3,
          paddingLeft: () => 4,
          paddingRight: () => 4,
        },
        // Margem mínima: a caixa deve colar logo abaixo da tabela, não
        // flutuar isolada - um vão grande dava a impressão de que o resumo
        // pertencia a outra seção da página.
        margin: [0, 2, 0, 0],
      },
    ];
  }

  private rodape(geradoPor: string, pagina: number, totalDePaginas: number): Content {
    return {
      margin: [this.layout.page.margins.left, 10, this.layout.page.margins.right, 0],
      columns: [
        { text: geradoPor, fontSize: this.layout.fonts.footer, color: this.layout.colors.textMuted },
        {
          text: `Página ${pagina} de ${totalDePaginas}`,
          alignment: 'right',
          fontSize: this.layout.fonts.footer,
          color: this.layout.colors.textMuted,
        },
      ],
    };
  }

  private caminhoDaFonte(arquivo: string): string {
    return path.join(PASTA_TEMPLATES, 'reports', 'fonts', arquivo);
  }
}
