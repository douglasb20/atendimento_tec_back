import { nomeCompleto } from '@/Utils';
import { SupportChats } from './entities/support-chats.entity';

/**
 * Troca as variáveis `{{chave}}` das mensagens automáticas pelos valores da
 * conversa.
 *
 * ⚠️ **Tolerante de propósito.** Variável desconhecida ou valor ausente vira
 * string vazia, nunca erro: uma saudação não pode deixar de sair porque o
 * contato ainda não tem cliente associado. É o oposto do Handlebars dos
 * e-mails, que roda com `strict: true` e lança - lá o template é nosso e um
 * furo é bug; aqui o texto é escrito pelo usuário e um `{{nomee}}` digitado
 * errado não pode derrubar o atendimento.
 *
 * ⚠️ A lista precisa casar com `front/src/components/EditorMensagem/variaveis.ts`,
 * que é o que a tela oferece. Variável só de um lado ou não é oferecida, ou
 * chega crua ao cliente.
 */

/** Marcador `{{ chave }}`, tolerando espaços em volta do nome. */
const MARCADOR = /\{\{\s*([a-z_]+)\s*\}\}/gi;

/**
 * "Bom dia" / "Boa tarde" / "Boa noite" pelo horário do servidor.
 *
 * ⚠️ Horário do servidor, não do contato: não guardamos o fuso de quem
 * escreve. Para o público desta operação, que é do mesmo país, a diferença é
 * a hora da virada em casos de borda.
 */
const saudacaoDoHorario = (agora = new Date()): string => {
  const hora = agora.getHours();
  if (hora < 12) return 'Bom dia';
  if (hora < 18) return 'Boa tarde';
  return 'Boa noite';
};

/** Telefone em `(64) 9 9269-8043`, como a tela mostra. */
const formataTelefone = (telefone?: string | null): string => {
  const digitos = (telefone ?? '').replace(/\D/g, '');
  const semDdi = digitos.startsWith('55') && digitos.length > 11 ? digitos.slice(2) : digitos;

  if (semDdi.length === 11) {
    return `(${semDdi.slice(0, 2)}) ${semDdi[2]} ${semDdi.slice(3, 7)}-${semDdi.slice(7)}`;
  }
  if (semDdi.length === 10) {
    return `(${semDdi.slice(0, 2)}) ${semDdi.slice(2, 6)}-${semDdi.slice(6)}`;
  }
  return telefone ?? '';
};

/** CNPJ em `12.345.678/0001-90`; devolve o que veio quando não tem 14 dígitos. */
const formataCnpj = (cnpj?: string | null): string => {
  const d = (cnpj ?? '').replace(/\D/g, '');

  if (d.length !== 14) return cnpj ?? '';

  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

/**
 * Valores disponíveis para a conversa.
 *
 * Exige `contact`, `contact.client` e `channel` carregados — sem eles as
 * variáveis correspondentes saem vazias, o que é o comportamento tolerante,
 * mas não é o pretendido. Quem chama precisa trazer as relações.
 */
const valoresDaConversa = (supportChat: SupportChats): Record<string, string> => ({
  saudacao: saudacaoDoHorario(),

  // ⚠️ `{{nome}}` é o **primeiro nome** desde a separação das colunas. Antes
  // devolvia o nome inteiro; quem quer o comportamento antigo usa
  // `{{nome_completo}}`.
  nome: supportChat.contact?.name ?? '',
  sobrenome: supportChat.contact?.last_name ?? '',
  nome_completo: nomeCompleto(supportChat.contact),

  telefone: formataTelefone(supportChat.contact?.phone),
  protocolo: supportChat.protocol ?? '',
  cliente: supportChat.contact?.client?.nome ?? '',
  cnpj: formataCnpj(supportChat.contact?.client?.cnpj),
  canal: supportChat.channel?.name ?? '',

  // O atendente sai vazio na saudação: ela é enviada na abertura, quando
  // ninguém assumiu a conversa ainda. Na despedida, já tem dono.
  atendente: supportChat.user?.name ?? '',
  atendente_sobrenome: supportChat.user?.last_name ?? '',
  atendente_nome_completo: nomeCompleto(supportChat.user),
});

/**
 * Aplica as variáveis ao texto. Devolve `null` quando não há o que enviar —
 * assim quem chama decide com um `if` só.
 */
export const montaMensagemAutomatica = (
  texto: string | null | undefined,
  supportChat: SupportChats,
): string | null => {
  const original = texto?.trim();
  if (!original) return null;

  const valores = valoresDaConversa(supportChat);
  const montado = original.replace(MARCADOR, (_, chave: string) => valores[chave.toLowerCase()] ?? '');

  // Um texto que era só variáveis, todas vazias, vira espaço em branco -
  // enviar isso ao cliente é pior do que não enviar nada.
  return montado.trim() || null;
};
