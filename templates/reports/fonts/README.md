# Fontes do PDF

Os quatro `.ttf` do Roboto, extraídos uma vez do `vfs_fonts.js` do pdfmake.

A versão 0.2 (a estável) não distribui os `.ttf` soltos - só o `vfs_fonts.js`,
que é o empacotamento para navegador, com ~2 MB de base64. Passá-lo ao printer
não funcionou em nenhuma das formas documentadas; caminho de arquivo funciona.

Ficando aqui, seguem o mesmo trajeto da logo até produção: o `nest-cli.json`
copia `templates/**/*` para `dist/templates/`, e o Dockerfile leva o `dist`.

Para regerar, com o pdfmake instalado:

```js
const fs = require('fs'), path = require('path');
const vfs = require('pdfmake/build/vfs_fonts.js');
const tabela = vfs.pdfMake ? vfs.pdfMake.vfs : vfs;
for (const [nome, b64] of Object.entries(tabela))
  fs.writeFileSync(path.join('templates/reports/fonts', nome), Buffer.from(b64, 'base64'));
```
