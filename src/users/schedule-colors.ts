/**
 * Paleta fixa da agenda. Uma cor por atendente: ampliar a capacidade é só
 * acrescentar uma entrada aqui e na migration de inicialização da base.
 */
export const CORES_AGENDA = [
  // Alterna famílias para que atendentes cadastrados em sequência sejam
  // reconhecíveis no calendário sem depender de tons muito próximos.
  '#EF4444', '#3B82F6', '#F59E0B', '#22C55E', '#8B5CF6', '#EC4899',
  '#06B6D4', '#F97316', '#84CC16', '#6366F1', '#D946EF', '#0F766E',
  '#F43F5E', '#EAB308', '#10B981', '#A855F7', '#0EA5E9', '#0369A1',
  '#BE123C', '#14B8A6', '#78716C', '#4338CA', '#7E22CE', '#64748B',
] as const;

export type CorAgenda = (typeof CORES_AGENDA)[number];
