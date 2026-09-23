/**
 * O que uma mensagem interna pode ser.
 *
 * Enum próprio, e não o `MessageTypes` do WhatsApp: aquele é o vocabulário do
 * protocolo (`chat` para texto, `ptt` para áudio de voz) e carrega duas dezenas
 * de valores que não existem aqui - enquete, localização, cartão de contato,
 * notificação de grupo. Aqui são seis, com os nomes que a tela usa.
 */
export enum InternalMessageType {
  TEXT = 'text',
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
  /** Arquivo de áudio anexado. */
  AUDIO = 'audio',
  /** Gravado na hora pelo microfone - o que o WhatsApp chama de `ptt`. */
  VOICE = 'voice',
}

/** Os tipos que trazem arquivo junto. */
export const TIPOS_COM_MIDIA: readonly InternalMessageType[] = [
  InternalMessageType.IMAGE,
  InternalMessageType.VIDEO,
  InternalMessageType.DOCUMENT,
  InternalMessageType.AUDIO,
  InternalMessageType.VOICE,
];

export const ehTipoComMidia = (tipo: InternalMessageType): boolean =>
  TIPOS_COM_MIDIA.includes(tipo);

/**
 * O usuário é o superusuário?
 *
 * ⚠️ `is_superuser` é **anulável**: cadastro antigo pode ter `NULL` em vez de
 * `0`. Comparar com `=== 1` é o certo; testar a veracidade do campo trataria
 * `NULL` como falso por acidente, e qualquer outro valor como verdadeiro.
 *
 * O superusuário fica fora do chat interno - é a conta de instalação, não um
 * atendente. `UserRepository.findActives()` já o omite da lista de colegas pelo
 * mesmo motivo.
 */
export const ehSuperusuario = (usuario?: { is_superuser?: number | null } | null): boolean =>
  Number(usuario?.is_superuser) === 1;

/**
 * Ordena um par de usuários para gravar em `internal_chats`.
 *
 * A tabela guarda sempre o menor id em `user_a_id`, e o banco recusa o
 * contrário. Sem a ordenação, A→B e B→A criariam duas conversas para a mesma
 * dupla, cada uma com metade das mensagens.
 */
export const ordenarPar = (um: number, outro: number): [number, number] =>
  um < outro ? [um, outro] : [outro, um];
