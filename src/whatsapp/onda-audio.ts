/**
 * Onda da nota de voz (alturas de 0 a 100, 64 no WhatsApp) a partir do que o
 * provider manda. O protobuf guarda em bytes, e cada caminho até aqui os
 * serializa de um jeito: base64 (nosso gateway, padrão do JSON do protobuf),
 * array, `{ type: 'Buffer', data }` ou objeto de índices (`JSON.stringify` de
 * um Uint8Array). Qualquer outra coisa vira `null`: sem onda, o balão desenha
 * barras retas.
 */
export function decodificarOnda(valor: unknown): number[] | null {
  let alturas: unknown[] | null = null;
  if (typeof valor === 'string') {
    if (!valor || !/^[A-Za-z0-9+/]+={0,2}$/.test(valor)) return null;
    alturas = [...Buffer.from(valor, 'base64')];
  } else if (Array.isArray(valor)) {
    alturas = valor;
  } else if (valor && typeof valor === 'object') {
    const objeto = valor as Record<string, unknown>;
    alturas = Array.isArray(objeto.data) ? objeto.data : Object.values(objeto);
  }
  if (!alturas?.length || !alturas.every((a) => typeof a === 'number' && Number.isFinite(a))) return null;
  return (alturas as number[]).map((a) => Math.min(100, Math.max(0, Math.round(a))));
}
