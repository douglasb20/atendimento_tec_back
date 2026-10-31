import { FUSO_EXIBICAO } from './fuso-exibicao';

/** A data operacional é a mesma no servidor local e no container em produção. */
export function partesDataAtendimento(agora: Date) {
  const partes = new Intl.DateTimeFormat('en-GB', {
    timeZone: FUSO_EXIBICAO,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(agora);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((p) => p.type === tipo)!.value;
  const data = `${valor('year')}-${valor('month')}-${valor('day')}`;
  return {
    data, ano: Number(valor('year')), mes: Number(valor('month')), dia: Number(valor('day')),
    diaSemana: new Date(`${data}T12:00:00Z`).getUTCDay(),
    hora: `${valor('hour')}:${valor('minute')}`,
  };
}
