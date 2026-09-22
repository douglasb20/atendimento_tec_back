import { Response } from 'express';

/** Nomes dos cookies de sessão, usados na gravação e na leitura pelo JWT. */
export const COOKIE_ACCESS = 'token';
export const COOKIE_REFRESH = 'refresh_token';
/** Lido pelo front para saber quando renovar - este **não** é httpOnly. */
export const COOKIE_EXPIRES = 'expires_at';

/**
 * Grava os cookies de sessão na resposta.
 *
 * Os dois tokens saem como **httpOnly**: o JavaScript da página não os alcança,
 * então um XSS não consegue roubá-los. O navegador continua enviando os dois em
 * toda requisição - `httpOnly` impede a leitura por script, não o envio.
 *
 * O `expires_at` é legível de propósito: o middleware e o `ApiClient` precisam
 * saber *quando* o access expira para disparar a renovação antes de a
 * requisição falhar. Ele carrega só um timestamp, nada sensível.
 *
 * `sameSite: 'lax'` protege contra CSRF sem quebrar a navegação normal. Em
 * produção front e API ficam em subdomínios distintos
 * (`suporte.` e `api.automatecsistemasweb.com.br`), então o cookie é gravado no
 * domínio-pai via `COOKIE_DOMAIN` - sem isso ele ficaria preso ao host da API e
 * o front nunca o receberia de volta.
 */
export function gravaCookiesDeSessao(
  res: Response,
  tokens: { access_token: string; refresh_token: string; access_exp: number; refresh_exp: number },
) {
  const agora = Math.floor(Date.now() / 1000);
  // Todos vivem enquanto o refresh viver: um cookie que morra antes impediria
  // a renovação, que foi exatamente o bug do `maxAge` fixo no front.
  const maxAge = Math.max(0, tokens.refresh_exp - agora) * 1000;

  const base = {
    // `secure` exige HTTPS; em desenvolvimento o front roda em http://localhost
    // e o cookie seria descartado silenciosamente pelo navegador.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
    ...(process.env.COOKIE_DOMAIN && { domain: process.env.COOKIE_DOMAIN }),
  };

  res.cookie(COOKIE_ACCESS, tokens.access_token, { ...base, httpOnly: true });
  res.cookie(COOKIE_REFRESH, tokens.refresh_token, { ...base, httpOnly: true });
  res.cookie(COOKIE_EXPIRES, String(tokens.access_exp), { ...base, httpOnly: false });
}

/** Remove os três no logout - mesmas opções, senão o navegador não os casa. */
export function limpaCookiesDeSessao(res: Response) {
  const base = {
    path: '/',
    ...(process.env.COOKIE_DOMAIN && { domain: process.env.COOKIE_DOMAIN }),
  };

  for (const nome of [COOKIE_ACCESS, COOKIE_REFRESH, COOKIE_EXPIRES]) {
    res.clearCookie(nome, base);
  }
}
