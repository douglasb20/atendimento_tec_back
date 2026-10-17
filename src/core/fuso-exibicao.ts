/**
 * O fuso em que o dia é contado para exibição.
 *
 * O banco guarda em UTC (`timestamptz`) e roda com `timezone = UTC`: sem
 * converter, um atendimento encerrado às 22h de Brasília cairia no dia
 * seguinte em qualquer gráfico, relatório ou agrupamento por data.
 *
 * O idioma de conversão é `AT TIME ZONE` no próprio Postgres, e não no Node:
 * o `date-fns-tz` não está instalado, e agrupar por dia precisa acontecer
 * dentro da consulta de qualquer forma.
 *
 * Fixo por ora - quando houver configuração global de fuso, é daqui que ela
 * entra (ver a tela de configurações planejada). Vive aqui, e não dentro de
 * um módulo, porque dashboard e relatórios precisam do mesmo valor: duas
 * cópias da string é como as duas divergem depois.
 */
export const FUSO_EXIBICAO = 'America/Sao_Paulo';
