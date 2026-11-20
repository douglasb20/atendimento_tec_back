import type { GrupoConversa } from '@/support-chats/grupo-conversa';
import type { PreferenciasUsuario } from '@/user-config/user-config.catalogo';

/**
 * Regras do push do app (spec `mobile/docs/specs/2026-11-18-fase-2b-push-design.md`).
 * Funções puras: quem decide o envio é o `PushService`, com os dados do banco.
 */

type ChaveDoGrupo = 'push_fila' | 'push_chatbot' | 'push_mensagem_cliente';

/** A preferência que vale para a mensagem de cada grupo (mesma divisão do portal). */
export function chaveDoGrupo(grupo: GrupoConversa): ChaveDoGrupo {
  if (grupo === 'espera') return 'push_fila';
  if (grupo === 'chatbot') return 'push_chatbot';
  return 'push_mensagem_cliente';
}

/**
 * Avisa a mensagem do cliente a este usuário?
 *
 * Fora do horário de **todos** os setores dele, só a conversa em atendimento
 * com ele (`ehDono`) avisa. Sem setor nenhum conta como dentro do horário: o
 * "todos fechados" de uma lista vazia seria verdade por vacuidade e calaria
 * quem não tem setor.
 */
export function deveAvisarMensagem(p: {
  grupo: GrupoConversa;
  preferencias: PreferenciasUsuario;
  ehDono: boolean;
  setoresAbertos: boolean[];
}): boolean {
  if (p.preferencias.push_habilitado !== true) return false;
  if (p.preferencias[chaveDoGrupo(p.grupo)] !== true) return false;
  const foraDoHorario = p.setoresAbertos.length > 0 && p.setoresAbertos.every((aberto) => !aberto);
  return !foraDoHorario || p.ehDono;
}

/** Transferência para mim avisa dentro e fora do horário: vira atendimento dele. */
export function deveAvisarTransferencia(preferencias: PreferenciasUsuario): boolean {
  return preferencias.push_habilitado === true && preferencias.push_transferencia === true;
}

const PREVIAS: Record<string, string> = {
  ptt: '🎤 Áudio',
  audio: '🎤 Áudio',
  image: '📷 Foto',
  video: '🎥 Vídeo',
  document: '📄 Documento',
  sticker: 'Figurinha',
  location: '📍 Localização',
  contact: '👤 Contato',
  vcard: '👤 Contato',
};

const TAMANHO_PREVIA = 120;

/** O texto do aviso: o tipo da mídia, ou o texto sem `*`, `_`, `~` e ```. */
export function previaDoAviso(m: { type: string; content: string | null }): string {
  const tipo = PREVIAS[m.type];
  if (tipo) return tipo;
  const texto = (m.content ?? '').replace(/```/g, '').replace(/[*_~]/g, '').trim();
  return texto ? texto.slice(0, TAMANHO_PREVIA) : 'Nova mensagem';
}

type ConversaComContato = {
  contact?: {
    name?: string | null;
    last_name?: string | null;
    remote_jid?: string | null;
    client?: { nome?: string | null } | null;
  } | null;
};

/**
 * Título do aviso, mesma regra do cabeçalho da conversa no app: o cliente;
 * sem cliente, o contato; sem nome, o número. O `nomeCompleto` de `@/Utils`
 * não é importado porque aquele módulo lê as chaves de criptografia no import.
 */
export function tituloDaConversa(chat: ConversaComContato): string {
  const contato = chat.contact;
  const cliente = contato?.client?.nome?.trim();
  if (cliente) return cliente;
  const nome = [contato?.name, contato?.last_name].filter(Boolean).join(' ').trim();
  if (nome) return nome;
  return contato?.remote_jid?.split('@')[0] || 'Contato';
}
