# CLAUDE.md — tecnicos-api

Guia do backend. O `CLAUDE.md` da raiz do workspace cobre a visão geral e os
outros subprojetos; aqui está o que é específico desta API.

NestJS 11 · TypeORM 0.3 · PostgreSQL · Redis (BullMQ + cache) · Socket.IO ·
S3-compatible (Backblaze B2).

## Comandos

```bash
npm run start:dev            # watch; a porta vem de PORT (ou APP_ENV), padrão 3001
npm run build                # nest build → dist/ (deleteOutDir limpa antes)
npm run lint                 # eslint --fix
npm test                     # jest sobre src/**/*.spec.ts
npm test -- evolution.mapper # arquivo único (regex sobre o caminho)
npm run migration:run        # compila e roda as migrations de dist/
```

Não existe `migration:generate` nem `migration:revert` — migrations são escritas
à mão. Ver "Banco de dados" abaixo.

## Ambiente

`PORT` define a porta. **`APP_ENV` também guarda a porta, não o ambiente** — o
nome engana, e preenchê-la com `production` fez o Nest escutar num socket Unix
em vez de TCP (`main.ts:44`). `PORT` tem precedência; sem nenhuma das duas, 3001.

`CRYPTO_KEY` (64 hex) e `CRYPTO_IV` (32 hex) são lidos no **import** de
`src/Utils/index.ts` — ausentes, o processo quebra no boot, não em runtime.
Trocar a `CRYPTO_KEY` torna ilegíveis todas as credenciais de integração já
gravadas.

`CORS_ORIGINS` (lista separada por vírgula) alimenta tanto o CORS HTTP quanto o
do gateway Socket.IO, pela mesma função `origensPermitidas()`. Vazio equivale a
`http://localhost:3000`.

`./files` precisa existir — é servida estaticamente em `/files/` e o Nest não
sobe sem ela.

⚠️ O `.env.exemple` está parcialmente desatualizado: traz `URL_WHATSAPP_API` e
`BUCKET_*` (obsoletos) e não lista `REDIS_*` nem `MEDIA_RETENTION_MONTHS`.

## Ciclo de vida do atendimento

Estados em `src/@types/index.ts` (`SupportChatStatusId`), semeados em
`support_chat_status`: 1 Aguardando, 2 Em andamento, 3 Em fila, 4 Finalizado sem
resposta, 5 Finalizado. Os dois últimos têm `is_final = true`.

**A regra que amarra tudo:** `findOrOpen` só reaproveita conversa com
`is_final = false`. Finalizar faz a próxima mensagem do contato abrir outro chat,
com protocolo novo — é o que dá o comportamento de ticket.

`iniciarAtendimento(id, user_id)` — idempotente para o mesmo dono (duplo clique
não é erro), `ConflictException` se outro atendente já assumiu. A corrida entre
dois cliques simultâneos é arbitrada pelo banco: o UPDATE tem
`WHERE ... AND support_chat_status_id IN (AGUARDANDO, EM_FILA)`, e `affected = 0`
vira conflito.

`finalizarAtendimento(id, user_id, dto)` — valida nesta ordem: existe →
não finalizado → está EM_ANDAMENTO → **é o dono** (`ForbiddenException`) →
**contato tem cliente** (`BadRequestException`). A última é reforço da regra do
front. Zera `unread_count` e grava sempre status 5; o status 4 existe no seed e
nenhum código o atribui.

`marcarComoLida(id)` apenas zera nosso contador. É distinto de
`marcarLidasNoWhatsapp`, que envia o tique azul e **só roda quando o atendente
responde** — abrir e sair sem responder não é atendimento.

`editMessage` / `deleteMessage` validam e chamam o provider, mas **não alteram o
banco**: quem grava é o webhook correspondente, que confirma que o WhatsApp
aceitou.

**Todo envio prefixa o texto com `*Nome do atendente:*\n`** — no WhatsApp do
cliente chega só texto, e é a única forma de identificar quem respondeu.

## Contagem de não lidas é nossa

O `chats.update` da Evolution chega apenas com `{remoteJid, instanceId}`, sem
`unreadCount`, e com o JID em formato `@lid`. Por isso a contagem é mantida por
nós: `incrementaNaoLidas` faz `UPDATE ... RETURNING`, e o evento é roteado para
`null` no mapper de propósito.

Detalhe do driver: `UPDATE ... RETURNING` devolve `[linhas, quantidade]`, não as
linhas direto — ler `resultado[0].unread_count` pega o array, não a linha.

## Pipeline do WhatsApp

```
Evolution ──POST /api/whatsapp/webhook (header x-webhook-secret)
   │
   ├─ canal desconhecido → 400   (a Evolution não reentrega 4xx)
   ├─ secret divergente  → 403   (timingSafeEqual; integração sem secret não bloqueia)
   ▼
WhatsappService.processWebhook → EvolutionMapper (normaliza) → BullMQ
   ├─ whatsapp-session-queue    (qr, ready, disconnected)
   └─ whatsapp-messages-queue   (concurrency: 1 — é o que garante a ordem)
   ▼
SupportChatsService.on*  (cada handler em runInTransaction)
   ▼
WhatsappGateway.emitEvent → broadcast Socket.IO
```

**Códigos de resposta têm semântica.** A Evolution reentrega até 10× com backoff,
mas **não repete 400, 401, 403, 404 e 422**. Payload inválido ou instância sem
canal → 4xx; falha nossa → 5xx, para o evento voltar.

Os `jobId` trocam `:` por `-`: o BullMQ recusa `:`, e o JID pode trazer sufixo de
dispositivo (`...:45@lid`).

**Não aumente a `concurrency` da fila de mensagens** sem substituir a ordenação
por outro mecanismo.

## Providers

`whatsapp-provider.interface.ts` é o contrato (15 métodos, vocabulário de
domínio, nenhum termo de provider). `provider.factory.ts` resolve pelo
`integration_providers.slug` e cacheia **por integração**, com chave
`${id}:${updated_at}` — trocar credencial recria o cliente HTTP sozinho.

`evolution.mapper.ts` é a peça mais sensível e a única com cobertura real
(`evolution.mapper.spec.ts`, fixtures do formato verdadeiro da v2.3.7). Ele
absorve as irregularidades do provider:

- `extractRemoteJid` lida com **três shapes**: `key.remoteJid`, `remoteJid` no
  topo, ou ambos, conforme o evento e a origem (celular vs API).
- `mapEdited` tem dois formatos, e no achatado o `timestampMs` vem em
  **milissegundos** — o upsert usa segundos.
- `mapStatusToAck` tem fallback diferente por origem: no upsert, mensagem
  recebida sem status é `ACK_DEVICE`; no update, `ACK_SERVER`.

`evolution.provider.ts` normaliza retornos polimórficos: o `connect` devolve
estado, QR cru **ou erro — sempre com HTTP 200**; `fetchConnectionState` trata
404 como "instância inexistente" (distinto de desconectada), e aí o provider a
cria com o webhook inline, guardando o `hash` como `instance_token` (a Evolution
só o entrega na criação).

⚠️ **Alterar `SUBSCRIBED_EVENTS` não afeta instâncias já criadas** — a lista só é
enviada no `/instance/create`. Exige recriar a instância ou reconfigurar o
webhook à mão. Um evento faltando é falha silenciosa: simplesmente não chega.

## Corridas conhecidas (e por que o código é assim)

**A Evolution dispara o webhook antes de a nossa transação commitar.** Três
mecanismos existem por causa disso — não os remova sem entender o efeito:

1. **Reserva no Redis** (`reservaEnvioComMidia`, TTL 120s) gravada *antes* de
   chamar o provider. Sem ela, o webhook baixaria de volta a mídia que acabamos
   de subir. O `processUploadMedia` consulta o Redis **antes** do banco.
2. **Upsert manual em `saveMessage`**: preserva o `datetime` da linha provisória
   (o do webhook chega depois e reordenaria a conversa), além de `file_name` e
   `media_size`, que o webhook não traz.
3. **Ack só avança**: eventos chegam fora de ordem, e um SERVER_ACK depois do
   READ faria a mensagem regredir de "lido" para "enviado". Exceção:
   `ACK_ERROR` sempre vale.

`whatsappChatStateEmit` recarrega do banco **mas sobrescreve cinco campos** com o
que veio do chamador, porque roda dentro da transação ainda não commitada. Sem o
`updated_at` forçado, a conversa com mensagem nova não sobe ao topo da lista.

## O `@lid`

Eventos chegam com `remoteJid` ora em `@s.whatsapp.net`, ora em `@lid` — dois
formatos do mesmo contato, e o segundo **não bate** com o `remote_jid` gravado.
Por isso acks e revogações são localizados **só pelo `message_id`** (UNIQUE),
nunca pelo JID. Ao escrever código novo que case eventos com registros, assuma
que o JID pode divergir.

## Storage

Bucket **público**: `getPublicUrl(key)` monta URL permanente, sem assinar. O
upload é por **PUT assinado** (o Backblaze responde `NotImplemented` ao
POST-policy do S3), com validade de 300s, e o browser transfere os bytes direto —
a mídia nunca passa pela API. No envio, passamos a **URL** ao provider, que
baixa; é o que viabiliza vídeos grandes.

⚠️ **As colunas `media_url`/`avatar_url` guardam a *key*, não a URL.** A
conversão é manual em cada caminho de saída — há três pontos que fazem isso
(`comUrlPublica`, `getUrlForMessageMedia`, `whatsappChatStateEmit`).

O S3Client usa `requestChecksumCalculation: 'WHEN_REQUIRED'`. Sem isso o SDK v3
assina a URL com `x-amz-checksum-crc32` — calculado sobre conteúdo *vazio*, já
que o arquivo ainda não existe — e o Backblaze recusa, com o preflight de CORS
falhando antes mesmo do upload.

**`media_expired` ≠ `is_deleted`.** O primeiro é a retenção (cron diário às 3h,
`MEDIA_RETENTION_MONTHS`, padrão 3): a mensagem **continua válida**, só a mídia
some. O segundo é revogação pelo contato, e aí o conteúdo é descartado de
propósito. O front exibe mensagens diferentes.

## Autenticação e permissões

```ts
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@Permissions('support.chat:update')
```

Strings no formato `<recurso>:<ação>`, com o recurso podendo ter ponto. O guard:

- lê o metadado **só do handler** — `@Permissions` na classe é ignorado;
- metadado ausente **libera**;
- a checagem é **OR** entre as permissões passadas;
- `is_superuser` ignora tudo, mas é verificado **depois** da consulta.

⚠️ **Algumas permissões usadas no código não existem no seed** — `supports:view`
(o seed tem `support:view`, singular), `channel:create` (seed tem `channel:add`),
`contact:view_by_client` e `permission:view`. Essas rotas hoje só funcionam para
superusuário. Ao mexer nelas, corrija a string ou acrescente o seed.

O `LogSistemaInterceptor` (global) registra cada requisição autenticada **e todas
as queries SQL** daquela requisição. Código que não passe pelo TypeORM não
aparece na auditoria. ⚠️ O `QueryStorageService` é singleton com array mutável e
sem `AsyncLocalStorage` — requisições concorrentes misturam queries.

## Convenções

**Repositories estendem `Repository<T>`** diretamente (`super(Entity,
dataSource.manager)`), registrados como provider comum, sem
`@InjectRepository`. Métodos de escrita recebem `manager: EntityManager` como
último parâmetro, para participar da transação do chamador.

**`runInTransaction(dataSource, async (manager) => {...})`** (`src/Utils`) é o
padrão — todos os handlers de webhook e as ações de ciclo de vida usam.

⚠️ **Antipadrão convivendo:** `PermissionService` e `SupportsService` criam um
`QueryRunner` no construtor e o reusam entre chamadas. Não é seguro sob
concorrência e não deve ser copiado.

**Aliases:** `@/*` → `src/*`, e como `baseUrl` é `./src`, imports bare também
resolvem (`from 'auth/auth.service'`, `from 'Utils'`). `@types` é a pasta
`src/@types`, **não** o `@types` do npm.

**TypeScript frouxo de propósito** — `strictNullChecks: false`,
`noImplicitAny: false` — mas `noUnusedLocals` e `noUnusedParameters` estão
**ligados**: variável não usada quebra o build (daí o `_session` com underscore).

Arquivos `.http` ficam ao lado de cada módulo, para o REST client do VS Code.

Nomenclatura em **português** nas partes novas (`iniciarAtendimento`,
`comUrlPublica`), inglês nas antigas (`saveIncoming`). Colunas em `snake_case`.

## Banco de dados

`synchronize: false`. O `orm-cli-config.ts` aponta as migrations para **`dist/`**
e tem `entities: []` — por isso o `migration:run` compila antes, e por isso
**gerar migration por diff de entidades não funciona**. Escreva à mão.

Campos com `select: false` exigem `addSelect` explícito: `password`,
`instance_token`, `credentials`, `webhook_secret`, `raw_payload`. Os repositories
têm métodos `*WithCredentials`/`*WithToken` para isso — credenciais nunca saem
por API.

Seeds vivem dentro das migrations, com **ids explícitos** e sem ajustar a
sequence: inserir permissão ou módulo novo via API pode colidir.

`SupportChats.channel` é `eager: true` — todo `find` de chat carrega o canal.

A lista de conversas ordena por subconsulta `MAX(m.datetime)` com `NULLS LAST`, e
não por `updated_at`: este muda em qualquer alteração de status e reordenaria a
lista sem motivo visível ao atendente.

## Pontas soltas conhecidas

- `StorageController.getPresignedUrl` tem uma **key hardcoded** e nenhum guard —
  é código de teste exposto.
- `MessagesController` está vazio.
- `ChannelsListener` escuta eventos `whatsapp.*` do EventEmitter que **ninguém
  emite** — o fluxo real passa pela fila. Caminho morto.
- `CONTACT_CHANGED` é mapeado, mas nenhum processor o trata.
- `WhatsappGateway.emitEvent` faz **broadcast para todos** os clientes, sem sala
  por usuário nem filtro de permissão. `emitToUser` existe e não é usado.
- `generateProtocol` lê o contador sem lock — duas conversas simultâneas podem
  colidir. O contador também nunca reinicia por mês, apesar do prefixo `AAAAMM`.
- Dos 14 arquivos `.spec.ts`, 13 são scaffolds `should be defined` que não
  passam (montam o service sem as dependências). O único real é o do mapper.
