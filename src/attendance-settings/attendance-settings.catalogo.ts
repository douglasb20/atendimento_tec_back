/**
 * Tudo que o atendimento aceita como ajuste configurável.
 *
 * É a fonte única: o backend valida a escrita contra este catálogo, converte a
 * leitura com ele, e o front monta a tela a partir dele. Acrescentar um ajuste
 * é acrescentar uma entrada aqui - sem migration, sem mexer na tela. Hoje só há
 * booleanos; um tipo novo (ex. "escolha") só entraria quando um ajuste
 * realmente precisar de mais de duas opções.
 */

export type DefinicaoAjusteAtendimento = {
  /** Como o campo aparece na tela. */
  rotulo: string;
  /** Uma linha explicando o efeito - a tela mostra abaixo do campo. */
  descricao: string;
  /** Vale quando não há valor gravado no banco. */
  padrao: boolean;
};

export const CATALOGO = {
  assinatura_nome_completo: {
    rotulo: 'Assinatura do atendente com o nome completo',
    descricao:
      'Toda mensagem enviada é prefixada com o nome de quem respondeu. Desligado, usa só o primeiro nome.',
    padrao: false,
  },

  atalho_mensagem_automatico: {
    rotulo: 'Enviar automaticamente o atalho de mensagem',
    descricao:
      'Ao digitar o atalho de uma resposta rápida, envia direto. Desligado, só preenche o campo de texto.',
    padrao: true,
  },

  ordenar_atendimento_por_ultima_mensagem: {
    rotulo: 'Ordenar atendimento pela última mensagem',
    descricao:
      'A fila reordena a cada mensagem nova. Desligado, mantém a ordem de chegada do atendimento.',
    padrao: false,
  },

  notificar_mensagem_chatbot: {
    rotulo: 'Notificar mensagem do ChatBot',
    descricao: 'Avisa o atendente quando o chatbot envia uma mensagem na conversa.',
    padrao: true,
  },

  carregar_mensagens_anteriores: {
    rotulo: 'Carregar mensagens anteriores',
    descricao:
      'Ao abrir uma conversa, o atendimento anterior deste contato já vem carregado. Desligado, é preciso clicar em "Ver atendimentos anteriores" para ver o histórico.',
    padrao: false,
  },
} as const satisfies Record<string, DefinicaoAjusteAtendimento>;

export type ChaveAjusteAtendimento = keyof typeof CATALOGO;

export const DEFINICOES: Record<ChaveAjusteAtendimento, DefinicaoAjusteAtendimento> = CATALOGO;

export const ehChaveValida = (chave: string): chave is ChaveAjusteAtendimento => chave in CATALOGO;
