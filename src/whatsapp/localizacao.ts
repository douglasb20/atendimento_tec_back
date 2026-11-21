/**
 * O `content` de uma mensagem de localização, recebida ou enviada: a primeira
 * linha são as coordenadas (o portal e o app leem dali o link do mapa); nome
 * e endereço, quando houver, nas linhas seguintes.
 */
export function conteudoDaLocalizacao(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
  nome?: string | null,
  endereco?: string | null,
): string {
  return [`${latitude ?? ''},${longitude ?? ''}`, nome, endereco].filter(Boolean).join('\n');
}
