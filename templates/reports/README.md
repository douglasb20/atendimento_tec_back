# Templates dos relatórios

O layout dos relatórios em PDF e Excel vive aqui, fora do código. É o papel que
o `.jrxml` cumpre no Jasper: descreve **o que aparece e como**, enquanto
`src/reports/report-pdf.service.ts` e `src/reports/report-excel.service.ts` são
os motores que desenham.

**Por quê:** hoje são poucos relatórios, mas a lista cresce. Com dezenas deles,
layout espalhado pelo código vira caça ao tesouro na manutenção. Aqui, mexer
numa coluna é abrir um arquivo que mostra a estrutura inteira de uma vez - sem
recompilar: os arquivos são lidos do disco. Em produção o cache só é limpo no
restart, o que coincide com o deploy.

**Nada hardcoded no controller ou no `.ts`.** Texto, rótulo, cor de coluna -
tudo o que é aparência do relatório mora no `<nome>.report.json`. Um relatório
novo não deveria exigir tocar em código para mudar uma palavra do que aparece.

## Os arquivos

| Arquivo | O que é |
| --- | --- |
| `report.layout.json` | Layout **compartilhado**: página, cabeçalho, cores, tipografia e tabela. Editar aqui muda todos os relatórios de uma vez. |
| `<nome>.report.json` | Um por relatório: título, colunas, larguras, formatação, totais. |
| `logo.png` | Cópia exata de `front/public/images/logoext.png`. Trocar a marca do portal significa trocar esta cópia. |
| `fonts/` | As fontes do PDF. Ver o README de lá. |

## Mexer num relatório

Abra o `<nome>.report.json`. As seções `pdf` e `excel` são independentes **de
propósito**: no PDF tudo é texto formatado para leitura (`1h 20min`); no Excel,
data é data e duração é número quando serve para somar, senão não dá para somar
nem fazer gráfico - que é a razão de alguém pedir Excel.

Cada coluna tem:

- `title` - o cabeçalho;
- `field` - a chave da linha devolvida pela consulta. Nome errado não quebra
  nada: a célula sai vazia, o que é fácil de notar;
- `width` - **só no PDF**: pontos (`"*"` divide o que sobra). **O Excel não usa
  `width`** - a largura é calculada pelo conteúdo real de cada coluna (ver
  "Padrões validados" abaixo);
- `align` - `left` (padrão), `right`, `center`. Vale nas duas saídas;
- `empty` - texto da célula sem valor, só no PDF, em itálico cinza;
- `format` - `duration` (segundos legíveis) ou `shortDateTime` no PDF;
  `duration` no Excel também funciona como texto legível;
- `type` - só no Excel: `date` ou `number`, para a célula guardar o tipo certo
  e dar para somar/ordenar/fazer gráfico.

## O que NÃO vive aqui

- **A consulta ao banco** (`src/reports/reports.service.ts`) - SQL vindo de
  arquivo editável seria outra história, com outros riscos.
- **As permissões** - cada relatório tem a sua, criada por migration.

## Padrões validados (seguir nos próximos relatórios)

Decisões tomadas e aprovadas nos dois primeiros relatórios (`attendance`,
`productivity`). Não reabrir a discussão - aplicar direto nos próximos.

### PDF

- **Rodapé da tabela (`pdf.total`)**: valores sob a própria coluna
  (`averages`), nunca um texto solto à esquerda resumindo o que a tabela já
  mostra. `summaryColumns` deixa só o mínimo de colunas iniciais livres para um
  `label` opcional (ex.: "Total geral"); o resto das colunas recebe um valor.
- **Caixa de resumo (`pdf.summary`)**: só para contagens que **não** são soma
  de nenhuma coluna da tabela (ex.: "9 atendimentos" não é soma de
  "Protocolo"). Fica numa caixa à parte, logo abaixo da tabela, com cabeçalho
  igual ao da tabela principal (fundo marinho, texto branco) e uma linha por
  item com traço inferior na cor `colors.line` do layout (não `textMuted` -
  muito escuro para um traço discreto).
- Quando a tabela já tem uma coluna que representa o total (ex.: produtividade
  tem "Total"/"Finalizados"), esses números vão em `pdf.total.averages`, nunca
  duplicados em `pdf.summary`.
- **Soma vs. média da coluna, num relatório agrupado**: a soma embaixo de uma
  coluna de **média por linha** (ex.: "Duração média" num relatório por
  atendente) é a soma literal dos valores daquela coluna - não é "soma de
  todos os atendimentos somados" (que é outro número, e só os dois coincidem
  quando há uma linha só). Se o relatório também tem uma coluna de tempo total
  de verdade (soma de todos os atendimentos), ela é campo separado
  (`duracao_total_segundos`), nunca reaproveitado para a coluna de média.

### Excel

- **Sem `width` fixo.** A largura de cada coluna é calculada pelo texto
  **formatado** que a célula vai exibir (`ReportExcelService.
  paraTextoFormatado`) - incluindo o `numFmt`, porque uma `Date` com
  `dd/mm/yyyy hh:mm` ocupa mais que a data sozinha, e medir só a data faz o
  Excel mostrar `###`.
- **Sem painel congelado** (`aba.views` com `state: 'frozen'`) - atrapalha mais
  do que ajuda numa planilha que o usuário vai reorganizar.
- **Sem coluna "(segundos)" ao lado da coluna legível**, a não ser que exista
  uso real de fórmula/gráfico sobre aquele número. Produtividade e
  atendimentos tiveram essas colunas removidas - duração em texto já é
  suficiente para quem só quer ler.
- **Alinhamento explícito (`align: "right"`) em toda coluna de texto que
  representa um número ou duração** (ex.: "Espera", "Duração"). O Excel só
  alinha à direita sozinho quando o tipo da célula é `number`/`Date` - uma
  duração como "3h 35min" é string, e sem `align` fica à esquerda, torta ao
  lado das colunas numéricas de verdade.
- **Linha de total (`excel.total`)**: sempre que o PDF tem `pdf.total`, o
  Excel correspondente também leva `excel.total` - mesmos campos, cada um sob
  sua própria coluna, numa linha só (o Excel não tem o limite de espaço do PDF
  que obriga a caixa de resumo separada).
- **Caixa de resumo (`pdf.summary`)** é reaproveitada automaticamente pelo
  Excel também (mesma seção do JSON, sem duplicar) - aparece logo abaixo da
  tabela e do total, no mesmo estilo visual do PDF (cabeçalho marinho, rótulo
  cinza, valor em negrito).

## Criar um relatório novo

1. A consulta e os tipos da linha, em `reports.service.ts`.
2. O `<nome>.report.json` aqui, no molde de `attendance.report.json` (lista) ou
   `productivity.report.json`/`client.report.json` (agrupado) - aplicando os
   padrões acima.
3. A permissão (`report.<nome>:view`), por migration.
4. As rotas no `reports.controller.ts`, apontando para o template novo -
   reaproveitando `totalDoPdf`/`totalDoExcel`/`resumoFinal` do
   `ReportTemplateService`, nunca escrevendo rótulo ou texto direto no
   controller.

## Relatórios com mais de um modo de agrupamento

`client.report.json` introduziu um padrão novo: a mesma linha pode significar
coisas diferentes conforme um filtro (`agrupar_por: 'client' | 'contact'`) - a
conta inteira ou o número de WhatsApp individual. Vale para qualquer relatório
futuro com essa mesma forma (um "todo" que agrupa vários "detalhes").

- **Uma coluna "genérica"** no template (`field: "nome"`), cujo `title`
  descreve o agrupamento mais comum (ex.: "Cliente") - o front troca o
  `header` exibido na tela conforme o filtro atual, mas o PDF/Excel usa o
  `title` do template sempre, porque cada export já é gerado para um
  agrupamento específico.
- **Um switch para excluir a linha "sem X"** (ex.: "Ignorar sem cliente"),
  desligado por padrão - mesma regra de sempre: decisão explícita do usuário,
  nunca subentendida. Esse switch só aparece/tem efeito no modo em que "sem X"
  é possível; no outro modo (contato, que nunca é nulo) ele some da tela.
- O chip de agrupamento na tela usa o mesmo componente `ChipFiltro` dos
  demais, com as opções como lista simples (não precisa de "Todos" - é sempre
  obrigatório escolher um dos dois).
