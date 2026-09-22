# Build em dois estágios: o primeiro compila, o segundo só roda.
# Sem isso, a imagem final carregaria o TypeScript, os tipos e todo o
# node_modules de desenvolvimento - algumas centenas de MB sem uso em produção.
FROM node:22-alpine AS build

WORKDIR /app

# As dependências mudam menos que o código: copiadas antes, o Docker reaproveita
# a camada e o `npm ci` só roda de novo quando o package-lock muda.
# O `.npmrc` vem junto: ele carrega `legacy-peer-deps=true`, sem o qual o
# `npm ci` falha - o `@liaoliaots/nestjs-redis` não declara compatibilidade com
# o NestJS 11, embora funcione com ele.
COPY package*.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

# ---

FROM node:22-alpine AS producao

WORKDIR /app

# `ffmpeg` é exigido pela conversão de áudio; `tzdata` porque o container nasce
# em UTC e as datas da aplicação pressupõem o fuso de São Paulo.
RUN apk add --no-cache ffmpeg tzdata
ENV TZ=America/Sao_Paulo

# ⚠️ **Só `--omit=dev`, sem `--omit=optional`.** A segunda flag já esteve aqui,
# para deixar de fora o `mjml` e o `preview-email` que o `@nestjs-modules/mailer`
# declara como opcionais e que este projeto não usa (o adapter é o Handlebars).
# Ela custava mais do que economizava:
#
# - **Derruba binários nativos.** Pacotes como o `@css-inline/css-inline` -
#   dependência obrigatória do mailer - distribuem um binário por plataforma,
#   todos como `optionalDependencies`. Sem eles a imagem sobe e quebra no
#   primeiro `require`, com o build passando normalmente.
# - **Levava junto dependências não declaradas.** O `mailer.service.js` faz
#   `require('lodash')` sem declará-lo (bug da 2.3.7); ele só chegava de carona
#   no `mjml`.
#
# Cada caso desses exigia declarar o pacote à mão no `package.json` - remendos
# de biblioteca de terceiros misturados com as dependências reais do projeto.
#
# O que a flag evitava não se confirmou: medido em 22/09/2026, a árvore
# completa tem **uma só versão do nodemailer (10.0.10)** e `npm audit` acusa
# **zero vulnerabilidades**. O custo real são ~70 MB de imagem, de pacotes que
# nunca são carregados - o `preview-email` só entra com `preview: true`.
COPY package*.json .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# A pasta é servida estaticamente em `/files/`; sem ela o Nest falha ao subir.
RUN mkdir -p files

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/main"]
