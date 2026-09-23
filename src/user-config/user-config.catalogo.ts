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
  // O que é dirigido a você diretamente nasce ligado; o que é da operação
  // inteira nasce desligado, porque é ruído para quem não a monitora.

  notif_chat_interno: {
    rotulo: 'Mensagem do chat interno',
    descricao: 'Avisa quando um colega manda mensagem direta.',
    tipo: 'booleano',
    grupo: 'notificacoes',
    padrao: true,
    ocultaParaSuperusuario: true,
  },

  notif_mensagem_cliente: {
    rotulo: 'Mensagem de cliente',
    descricao: 'Avisa quando chega mensagem numa conversa de atendimento.',
    tipo: 'booleano',
    grupo: 'notificacoes',
    padrao: true,
  },

  notif_fila: {
    rotulo: 'Atendimento novo na fila',
    descricao: 'Avisa quando entra uma conversa que ninguém assumiu.',
    tipo: 'booleano',
    grupo: 'notificacoes',
    padrao: false,
  },

  notif_transferencia: {
    rotulo: 'Atendimento transferido para mim',
    descricao: 'Avisa quando um colega passa um atendimento para você.',
    tipo: 'booleano',
    grupo: 'notificacoes',
    padrao: true,
  },

  notif_com_portal_aberto: {
    rotulo: 'Avisar mesmo com a tela de chat na frente',
    descricao:
      'Desligue para não receber aviso enquanto você já está na tela de chat, em foco - a mensagem aparece sozinha na lista.',
    tipo: 'booleano',
    grupo: 'notificacoes',
    // Ligado: é o comportamento do Whaticket e dos mensageiros em geral - o
    // aviso aparece mesmo com a aba na frente. Nasceu desligado por suposição
    // minha, e o usuário mostrou que a expectativa é a oposta. Quem se
    // incomodar desliga.
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
