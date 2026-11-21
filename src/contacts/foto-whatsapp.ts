/** Margem da validade: vencendo nas próximas horas já conta como vencida. */
const MARGEM_VALIDADE_MS = 6 * 60 * 60 * 1000;

/**
 * Se a URL da foto do WhatsApp (`pps.whatsapp.net`) já venceu ou vence em
 * breve: a validade vem em `oe=` (segundos, em hexadecimal). Sem `oe=` (foto
 * posta no nosso bucket) não há como vencer: trata como válida.
 */
export function fotoVencida(url: string | null | undefined, agora = Date.now()): boolean {
  const oe = url ? /[?&]oe=([0-9A-Fa-f]+)/.exec(url)?.[1] : undefined;
  return Boolean(oe) && parseInt(oe!, 16) * 1000 < agora + MARGEM_VALIDADE_MS;
}
