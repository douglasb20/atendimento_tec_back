import { padroes } from '@/user-config/user-config.catalogo';
import {
  chaveDoGrupo,
  deveAvisarMensagem,
  deveAvisarTransferencia,
  previaDoAviso,
  tituloDaConversa,
} from './regras-push';

const prefs = (mudancas: Record<string, boolean> = {}) => ({ ...padroes(), ...mudancas });
const aberto = [true];
const fechado = [false, false];

describe('preferências do celular no catálogo', () => {
  it('têm os padrões do portal, no grupo celular', () => {
    expect(padroes()).toMatchObject({
      push_habilitado: true,
      push_fila: false,
      push_chatbot: false,
      push_mensagem_cliente: true,
      push_transferencia: true,
    });
  });
});

describe('chaveDoGrupo', () => {
  it('cada grupo lê a sua chave; pausa conta como em atendimento', () => {
    expect(chaveDoGrupo('espera')).toBe('push_fila');
    expect(chaveDoGrupo('chatbot')).toBe('push_chatbot');
    expect(chaveDoGrupo('em_atendimento')).toBe('push_mensagem_cliente');
    expect(chaveDoGrupo('pausa')).toBe('push_mensagem_cliente');
  });
});

describe('deveAvisarMensagem', () => {
  it('a chave geral desligada bloqueia tudo', () => {
    expect(deveAvisarMensagem({ grupo: 'em_atendimento', preferencias: prefs({ push_habilitado: false }), ehDono: true, setoresAbertos: aberto })).toBe(false);
  });

  it('segue a chave do grupo', () => {
    expect(deveAvisarMensagem({ grupo: 'espera', preferencias: prefs(), ehDono: false, setoresAbertos: aberto })).toBe(false);
    expect(deveAvisarMensagem({ grupo: 'espera', preferencias: prefs({ push_fila: true }), ehDono: false, setoresAbertos: aberto })).toBe(true);
    expect(deveAvisarMensagem({ grupo: 'em_atendimento', preferencias: prefs(), ehDono: true, setoresAbertos: aberto })).toBe(true);
  });

  it('em atendimento ou pausa, só o dono é avisado (o master não recebe a dos outros)', () => {
    expect(deveAvisarMensagem({ grupo: 'em_atendimento', preferencias: prefs(), ehDono: false, setoresAbertos: aberto })).toBe(false);
    expect(deveAvisarMensagem({ grupo: 'pausa', preferencias: prefs(), ehDono: false, setoresAbertos: aberto })).toBe(false);
  });

  it('fora do horário só avisa a conversa que é dele', () => {
    const tudo = prefs({ push_fila: true, push_chatbot: true });
    expect(deveAvisarMensagem({ grupo: 'espera', preferencias: tudo, ehDono: false, setoresAbertos: fechado })).toBe(false);
    expect(deveAvisarMensagem({ grupo: 'chatbot', preferencias: tudo, ehDono: false, setoresAbertos: fechado })).toBe(false);
    expect(deveAvisarMensagem({ grupo: 'em_atendimento', preferencias: tudo, ehDono: false, setoresAbertos: fechado })).toBe(false);
    expect(deveAvisarMensagem({ grupo: 'em_atendimento', preferencias: tudo, ehDono: true, setoresAbertos: fechado })).toBe(true);
  });

  it('basta um setor aberto', () => {
    expect(deveAvisarMensagem({ grupo: 'espera', preferencias: prefs({ push_fila: true }), ehDono: false, setoresAbertos: [false, true] })).toBe(true);
  });

  it('sem setor conta como dentro do horário', () => {
    expect(deveAvisarMensagem({ grupo: 'espera', preferencias: prefs({ push_fila: true }), ehDono: false, setoresAbertos: [] })).toBe(true);
  });
});

describe('deveAvisarTransferencia', () => {
  it('precisa da geral e da de transferência', () => {
    expect(deveAvisarTransferencia(prefs())).toBe(true);
    expect(deveAvisarTransferencia(prefs({ push_transferencia: false }))).toBe(false);
    expect(deveAvisarTransferencia(prefs({ push_habilitado: false }))).toBe(false);
  });
});

describe('previaDoAviso', () => {
  it.each([
    ['ptt', '🎤 Áudio'],
    ['audio', '🎤 Áudio'],
    ['image', '📷 Foto'],
    ['video', '🎥 Vídeo'],
    ['document', '📄 Documento'],
    ['sticker', 'Figurinha'],
    ['location', '📍 Localização'],
    ['contact', '👤 Contato'],
    ['vcard', '👤 Contato'],
  ])('%s vira %s', (type, esperado) => {
    expect(previaDoAviso({ type, content: '0:12' })).toBe(esperado);
  });

  it('texto sai sem os marcadores do WhatsApp', () => {
    expect(previaDoAviso({ type: 'chat', content: '*Olá* _tudo_ ~bem~?' })).toBe('Olá tudo bem?');
    expect(previaDoAviso({ type: 'chat', content: '```codigo```' })).toBe('codigo');
  });

  it('texto vazio vira "Nova mensagem"', () => {
    expect(previaDoAviso({ type: 'chat', content: '' })).toBe('Nova mensagem');
    expect(previaDoAviso({ type: 'chat', content: null })).toBe('Nova mensagem');
  });

  it('corta em 120 caracteres', () => {
    expect(previaDoAviso({ type: 'chat', content: 'a'.repeat(200) })).toHaveLength(120);
  });
});

describe('tituloDaConversa', () => {
  it('cliente, senão contato, senão o número', () => {
    expect(tituloDaConversa({ contact: { name: 'Ana', last_name: 'Lima', remote_jid: '55@s.whatsapp.net', client: { nome: 'Padaria' } } })).toBe('Padaria');
    expect(tituloDaConversa({ contact: { name: 'Ana', last_name: 'Lima', remote_jid: '55@s.whatsapp.net', client: null } })).toBe('Ana Lima');
    expect(tituloDaConversa({ contact: { name: '', last_name: null, remote_jid: '5511999@s.whatsapp.net' } })).toBe('5511999');
  });
});
