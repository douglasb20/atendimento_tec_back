import type { IntervaloExcecao, ModoExcecao } from './entities/department-schedule-exceptions.entity';

export type DadosDisponibilidade = {
  ativo: boolean;
  respeitarFeriados: boolean;
  feriado: boolean;
  diaSemana: number;
  hora: string;
  semana: (IntervaloExcecao & { weekday: number })[];
  excecao?: { mode: ModoExcecao; intervals: IntervaloExcecao[] } | null;
};

/** Uma única precedência para a saudação automática e o fluxo do chatbot. */
export function avaliarDisponibilidadeSetor(dados: DadosDisponibilidade): boolean {
  if (!dados.ativo) return true;
  const dentro = (intervalos: IntervaloExcecao[]) => intervalos.some(
    (i) => i.start_time.slice(0, 5) <= dados.hora && dados.hora < i.end_time.slice(0, 5),
  );
  if (dados.excecao?.mode === 'fechado') return false;
  if (dados.excecao?.mode === 'especial') return dentro(dados.excecao.intervals);
  // "Normal" ignora só o fechamento pelo feriado, preservando o dia da semana.
  if (!dados.excecao && dados.respeitarFeriados && dados.feriado) return false;
  // Mantém o comportamento legado de setor sem nenhum intervalo configurado.
  return dados.semana.length === 0 || dentro(dados.semana.filter((i) => i.weekday === dados.diaSemana));
}
