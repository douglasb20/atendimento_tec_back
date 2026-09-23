/**
 * Tudo que o sistema aceita como ajuste configurável.
 *
 * É a fonte única: o backend valida a escrita contra este catálogo, converte a
 * leitura com ele, e o front monta a tela a partir dele. Acrescentar um ajuste
 * é acrescentar uma entrada aqui - sem migration, sem mexer na tela.
 *
 * Com chave-valor o banco não garante mais o tipo, que era o argumento a favor
 * de uma coluna por ajuste. Esta declaração é o que ocupa esse lugar: sem ela a
 * tabela viraria um saco de strings onde qualquer coisa cabe, e o erro só
 * apareceria quando o valor fosse usado.
 */

export type TipoAjuste = 'inteiro' | 'texto' | 'senha' | 'booleano';

export type DefinicaoAjuste = {
  /** Como o campo aparece na tela. */
  rotulo: string;
  /** Uma linha explicando o efeito - a tela mostra abaixo do campo. */
  descricao: string;
  tipo: TipoAjuste;
  /** Agrupa os campos na tela. */
  grupo: 'comportamento' | 'email';
  /** Sufixo exibido ao lado do valor (minutos, meses, MB…). */
  unidade?: string;
  min?: number;
  max?: number;
  /** Vale quando não há valor no banco nem na variável de ambiente. */
  padrao: string | number | boolean;
  /** De onde herdar o valor inicial, antes de alguém configurar pela tela. */
  env?: string;
};

export const CATALOGO = {
  // ==== Comportamento ====

  reset_senha_expiracao_min: {
    rotulo: 'Validade do link de redefinição de senha',
    descricao:
      'Quanto tempo o link enviado por e-mail continua servindo. Abaixo de 5 minutos o usuário não consegue abrir o e-mail a tempo.',
    tipo: 'inteiro',
    grupo: 'comportamento',
    unidade: 'minutos',
    min: 5,
    max: 1440,
    padrao: 30,
    env: 'RESET_SENHA_EXPIRACAO_MIN',
  },

  midia_retencao_meses: {
    rotulo: 'Retenção de mídia do atendimento',
    descricao:
      'Depois deste prazo, fotos, áudios e vídeos das conversas com clientes são apagados do storage. As mensagens continuam, sem o arquivo.',
    tipo: 'inteiro',
    grupo: 'comportamento',
    unidade: 'meses',
    min: 1,
    max: 120,
    padrao: 3,
    env: 'MEDIA_RETENTION_MONTHS',
  },

  chat_interno_retencao_meses: {
    rotulo: 'Retenção de mídia do chat interno',
    descricao:
      'Depois deste prazo, os arquivos trocados entre a equipe no chat interno são apagados do storage. As mensagens continuam, sem o arquivo.',
    tipo: 'inteiro',
    grupo: 'comportamento',
    unidade: 'meses',
    min: 1,
    max: 120,
    // Prazo próprio, e mais curto que o do atendimento: conversa entre colegas
    // é operacional e perde o valor rápido, enquanto a do cliente é registro do
    // que foi combinado com ele.
    padrao: 1,
    env: 'INTERNAL_CHAT_RETENTION_MONTHS',
  },

  refresh_expiracao_dias: {
    rotulo: 'Duração da sessão',
    descricao:
      'Por quanto tempo o atendente continua conectado sem precisar entrar de novo. Não encurta as sessões já abertas - elas carregam o prazo do momento do login.',
    tipo: 'inteiro',
    grupo: 'comportamento',
    unidade: 'dias',
    min: 1,
    max: 365,
    padrao: 30,
  },

  upload_max_mb: {
    rotulo: 'Tamanho máximo de arquivo',
    descricao:
      'Limite por arquivo enviado no chat. O teto de 512 MB é do protocolo do WhatsApp - dá para reduzir, nunca aumentar.',
    tipo: 'inteiro',
    grupo: 'comportamento',
    unidade: 'MB',
    min: 1,
    max: 512,
    padrao: 512,
  },

  // ==== E-mail ====
  //
  // Alterados aqui, valem na próxima mensagem enviada: o transporte é
  // registrado em tempo de execução, não na subida do processo.

  email_host: {
    rotulo: 'Servidor SMTP',
    descricao: 'Endereço do servidor de envio. Ex.: smtp.gmail.com',
    tipo: 'texto',
    grupo: 'email',
    padrao: '',
    env: 'MAIL_HOST',
  },

  email_port: {
    rotulo: 'Porta',
    descricao: '587 para STARTTLS, 465 para SSL direto.',
    tipo: 'inteiro',
    grupo: 'email',
    min: 1,
    max: 65535,
    padrao: 587,
    env: 'MAIL_PORT',
  },

  email_user: {
    rotulo: 'Usuário',
    descricao: 'Conta usada para autenticar no servidor.',
    tipo: 'texto',
    grupo: 'email',
    padrao: '',
    env: 'MAIL_USER',
  },

  email_pass: {
    rotulo: 'Senha',
    descricao:
      'No Gmail, use uma senha de aplicativo, não a senha da conta. Gravada criptografada e nunca devolvida pela API.',
    tipo: 'senha',
    grupo: 'email',
    padrao: '',
    env: 'MAIL_PASS',
  },

  email_from: {
    rotulo: 'Remetente',
    descricao: 'Como o destinatário vê o remetente. Ex.: Suporte <suporte@empresa.com>',
    tipo: 'texto',
    grupo: 'email',
    padrao: '',
    env: 'MAIL_FROM',
  },
} as const satisfies Record<string, DefinicaoAjuste>;

export type ChaveAjuste = keyof typeof CATALOGO;

/**
 * O catálogo visto como `DefinicaoAjuste`.
 *
 * O `as const` acima preserva os literais, o que é bom para autocompletar as
 * chaves - mas faz o TypeScript perder os campos opcionais (`min`, `max`,
 * `env`) na união de entradas heterogêneas. Quem lê uma definição usa esta
 * visão; quem precisa da chave exata usa `CATALOGO`.
 */
export const DEFINICOES: Record<ChaveAjuste, DefinicaoAjuste> = CATALOGO;

export const ehChaveValida = (chave: string): chave is ChaveAjuste => chave in CATALOGO;

/** As chaves cujo valor nunca sai da API. */
export const ehSegredo = (chave: ChaveAjuste): boolean => CATALOGO[chave].tipo === 'senha';
