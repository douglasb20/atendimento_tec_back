/**
 * Origens aceitas pelo CORS da API e pelo handshake do Socket.IO.
 *
 * Em produção o front roda num domínio próprio, então a lista precisa vir do
 * ambiente. `CORS_ORIGINS` aceita várias separadas por vírgula - útil quando
 * front e portal convivem, ou durante uma migração de domínio.
 *
 * Sem a variável, cai no localhost de desenvolvimento: é o que faz o `npm run
 * start:dev` continuar funcionando sem nenhum `.env` novo.
 */
export function origensPermitidas(): string[] {
  const configurado = process.env.CORS_ORIGINS?.trim();

  if (!configurado) return ['http://localhost:3000'];

  return configurado
    .split(',')
    .map((origem) => origem.trim())
    .filter(Boolean);
}
