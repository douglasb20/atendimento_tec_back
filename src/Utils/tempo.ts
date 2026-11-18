/**
 * Segundos em "MM:SS", o formato da duração de áudio no `content`.
 * Fora do `index.ts` porque ele lê as chaves de criptografia ao ser importado,
 * e quem só precisa formatar tempo (e os testes) não deve depender disso.
 */
export function toMMSS(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;

  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
