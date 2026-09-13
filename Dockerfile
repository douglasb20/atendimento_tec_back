# Build em dois estágios: o primeiro compila, o segundo só roda.
# Sem isso, a imagem final carregaria o TypeScript, os tipos e todo o
# node_modules de desenvolvimento — algumas centenas de MB sem uso em produção.
FROM node:22-alpine AS build

WORKDIR /app

# As dependências mudam menos que o código: copiadas antes, o Docker reaproveita
# a camada e o `npm ci` só roda de novo quando o package-lock muda.
# O `.npmrc` vem junto: ele carrega `legacy-peer-deps=true`, sem o qual o
# `npm ci` falha — o `@liaoliaots/nestjs-redis` não declara compatibilidade com
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

COPY package*.json .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# A pasta é servida estaticamente em `/files/`; sem ela o Nest falha ao subir.
RUN mkdir -p files

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/main"]
