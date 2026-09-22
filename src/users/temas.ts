/**
 * Valores aceitos na preferência de tema.
 *
 * ⚠️ **Esta lista precisa casar com `front/scripts/temas.config.mjs`**, que é
 * quem gera os CSS e monta os cards da tela. Uma cor aqui e não lá vira uma
 * preferência que o front não sabe aplicar; lá e não aqui, o backend recusa a
 * escolha com 400.
 *
 * Só os identificadores: rótulo, descrição e paleta são assunto da tela. O
 * backend valida e guarda, não decide como pinta.
 */

export const CORES_TEMA = [
  'automatec',
  'indigo',
  'azul',
  'ciano',
  'verde',
  'oceano',
  'laranja',
  'roxo',
  'rosa',
] as const;

export const MODOS_TEMA = ['claro', 'escuro', 'dim'] as const;

export type CorTema = (typeof CORES_TEMA)[number];
export type ModoTema = (typeof MODOS_TEMA)[number];
