import type { IntervaloExcecao, ModoExcecao } from './entities/department-schedule-exceptions.entity';

export function validarIntervalosExcecao(modo: ModoExcecao, intervalos: IntervaloExcecao[]): IntervaloExcecao[] {
  if (modo !== 'especial') {
    if (intervalos.length) throw new Error('Intervalos só podem ser informados no horário especial');
    return [];
  }
  if (!intervalos.length) throw new Error('Adicione ao menos um intervalo para o horário especial');
  const ordenados = [...intervalos].sort((a, b) => a.start_time.localeCompare(b.start_time));
  for (const [indice, intervalo] of ordenados.entries()) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(intervalo.start_time) ||
        !/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(intervalo.end_time)) {
      throw new Error('Informe horários válidos no formato HH:mm');
    }
    if (intervalo.start_time >= intervalo.end_time) throw new Error('O fim do intervalo deve ser posterior ao início');
    if (indice && ordenados[indice - 1].end_time > intervalo.start_time) {
      throw new Error('Os intervalos do horário especial não podem se sobrepor');
    }
  }
  return ordenados.map(({ start_time, end_time }) => ({ start_time, end_time }));
}
