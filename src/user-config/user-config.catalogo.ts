import { CORES_TEMA, MODOS_TEMA } from '@/users/temas';

/**
 * Tudo que cada usuário pode preferir.
 *
 * Fonte única, no mesmo espírito de `system-settings.catalogo.ts`: o backend
 * valida a escrita contra este catálogo e converte a leitura com ele, e o front
 * monta a aba de preferências a partir dele. Acrescentar uma preferência é
 * acrescentar uma entrada aqui - sem migration, sem mexer na tela.
 *
 * ⚠️ **Não confundir com `system_settings`.** Lá são ajustes do sistema, que
 * valem para todos e só o superusuário muda. Aqui é a preferência de cada um,
 * que cada um muda na sua.
 */

export type TipoPreferencia = 'texto' | 'booleano';

export type DefinicaoPreferencia = {
  /** Como aparece na tela. */
  rotulo: string;
  /** Uma linha explicando o efeito, abaixo do campo. */
  descricao: string;
  tipo: TipoPreferencia;
  /** Agrupa os campos nas abas do modal de perfil. */
  grupo: 'aparencia' | 'notificacoes';
  /**
   * Subdivide a aba de notificações.
   *
   * Separa **o que** avisa (`mensagens`, `movimentacoes`) de **como** avisa
   * (`entrega`), e deixa a chave geral (`geral`) à parte, no topo.
   */
  secao?: 'geral' | 'mensagens' | 'movimentacoes' | 'entrega';
  /** Vale enquanto a pessoa não escolher. */
  padrao: string | boolean;
  /** Valores aceitos, para os de texto que são uma lista fechada. */
  opcoes?: readonly string[];
  /**
   * A preferência não faz sentido para o superusuário.
   *
   * Hoje só a do chat interno: ele não participa, e um liga/desliga que nunca
   * dispararia nada seria oferecer algo quebrado.
   */
  ocultaParaSuperusuario?: boolean;
};

export const CATALOGO = {
  // ==== Aparência ====

  tema: {
    rotulo: 'Cor do tema',
    descricao: 'A paleta usada em todo o portal.',
    tipo: 'texto',
    grupo: 'aparencia',
    padrao: 'automatec',
    opcoes: CORES_TEMA,
  },

  modo_tema: {
    rotulo: 'Modo',
    descricao: 'Claro, escuro ou dim.',
    tipo: 'texto',
    grupo: 'aparencia',
    padrao: 'claro',
    opcoes: MODOS_TEMA,
  },

  // ==== Notificações ====
  //
  // Duas perguntas separadas: **o que** avisa (mensagens, movimentações) e
  // **como** avisa (entrega). Um evento só chega se a chave geral, o evento e
  // pelo menos um canal de entrega estiverem ligados.
  //
  // O que é dirigido a você nasce ligado; o que é da operação inteira nasce
  // desligado, porque é ruído para quem não a monitora.

  notif_habilitadas: {
    rotulo: 'Habilitar notificações',
    descricao: 'Controla todos os avisos do chat, inclusive o som.',
    tipo: 'booleano',
    grupo: 'notificacoes',
    secao: 'geral',
    padrao: true,
  },

  notif_fila: {
    rotulo: 'Mensagens na fila',
    descricao: 'Avisos de mensagens em atendimentos que ninguém assumiu.',
    tipo: 'booleano',
    grupo: 'notificacoes',
    secao: 'mensagens',
    padrao: false,
  },

  notif_mensagem_cliente: {
    rotulo: 'Mensagens em atendimento',
    descricao: 'Avisos de mensagens em conversas que já estão em atendimento.',
    tipo: 'booleano',
    grupo: 'notificacoes',
    secao: 'mensagens',
    padrao: true,
  },

  notif_chat_interno: {
    rotulo: 'Mensagens do chat interno',
    descricao: 'Avisos quando um colega manda mensagem direta.',
    tipo: 'booleano',
    grupo: 'notificacoes',
    secao: 'mensagens',
    padrao: true,
    ocultaParaSuperusuario: true,
  },

  notif_transferencia: {
    rotulo: 'Transferência',
    descricao: 'Avisos quando um atendimento for transferido para você.',
    tipo: 'booleano',
    grupo: 'notificacoes',
    secao: 'movimentacoes',
    padrao: true,
  },

  notif_som: {
    rotulo: 'Notificação sonora',
    descricao: 'Tocar alerta sonoro no navegador.',
    tipo: 'booleano',
    grupo: 'notificacoes',
    secao: 'entrega',
    padrao: true,
  },

  // ⚠️ Os dois abaixo **se revezam**, nunca aparecem juntos: com o portal na
  // frente vai o alerta na tela, minimizado ou em outra aba vai o do
  // navegador. Decisão do usuário, seguindo a referência que ele trouxe.
  // Substituiu `notif_com_portal_aberto`, que existia para o aviso do
  // navegador aparecer também com a aba na frente.
  notif_alerta_tela: {
    rotulo: 'Alerta na tela',
    descricao: 'Mostrar aviso dentro do portal quando ele estiver aberto na sua frente.',
    tipo: 'booleano',
    grupo: 'notificacoes',
    secao: 'entrega',
    padrao: true,
  },

  notif_navegador: {
    rotulo: 'Notificação do navegador',
    descricao: 'Mostrar notificação do sistema quando a aba estiver em segundo plano.',
    tipo: 'booleano',
    grupo: 'notificacoes',
    secao: 'entrega',
    padrao: true,
  },
} as const satisfies Record<string, DefinicaoPreferencia>;

export type ChavePreferencia = keyof typeof CATALOGO;

/**
 * O catálogo visto como `DefinicaoPreferencia`.
 *
 * O `as const satisfies` acima preserva os literais das chaves - é o que faz o
 * autocompletar funcionar -, mas faz o TypeScript perder os campos opcionais na
 * união heterogênea. Esta é a visão relaxada, para quem percorre o catálogo;
 * quem precisa da chave exata usa `CATALOGO`.
 */
export const DEFINICOES: Record<ChavePreferencia, DefinicaoPreferencia> = CATALOGO;

export const ehChaveValida = (chave: string): chave is ChavePreferencia => chave in CATALOGO;

/** O mapa de preferências como o front o consome. */
export type PreferenciasUsuario = Record<ChavePreferencia, string | boolean>;

/** Os padrões, para quem ainda não gravou nada. */
export const padroes = (): PreferenciasUsuario =>
  Object.fromEntries(
    Object.entries(DEFINICOES).map(([chave, def]) => [chave, def.padrao]),
  ) as PreferenciasUsuario;
