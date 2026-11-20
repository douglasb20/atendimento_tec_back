import { padroes } from '@/user-config/user-config.catalogo';
import type { Aviso } from './envio-firebase';

// Os services reais puxam entidades com o ciclo de `Users` que o Jest não
// resolve; o teste monta o PushService com dublês das dependências.
jest.mock('./envio-firebase', () => ({ ...jest.requireActual('./envio-firebase'), EnvioFirebase: class {} }));
jest.mock('@/devices/devices.service', () => ({ DevicesService: class {} }));
jest.mock('@/permissions/acesso-atendimento.service', () => ({ AcessoAtendimentoService: class {} }));
jest.mock('@/user-config/user-config.service', () => ({ UserConfigService: class {} }));
jest.mock('@/departments/disponibilidade-setor.service', () => ({ DisponibilidadeSetorService: class {} }));

import { mensagemDoAviso } from './envio-firebase';
import { PushService } from './push.service';

const EM_ANDAMENTO = 2;
const AGUARDANDO = 1;

function montar(opcoes: {
  celulares?: { user_id: number; token: string }[];
  podeVer?: (userId: number) => boolean;
  preferencias?: Record<number, Record<string, boolean>>;
  setores?: Record<number, number[]>;
  abertos?: Record<number, boolean>;
  invalidos?: string[];
  ativo?: boolean;
} = {}) {
  const enviados: { tokens: string[]; aviso: Aviso }[] = [];
  const contagem = { podeVer: 0, verificar: 0, emCurso: 0, maxEmCurso: 0 };
  const removidos: string[] = [];
  const celulares = opcoes.celulares ?? [{ user_id: 1, token: 't1' }];
  const envio = {
    ativo: opcoes.ativo ?? true,
    enviar: async (tokens: string[], aviso: Aviso) => {
      enviados.push({ tokens, aviso });
      return { invalidos: opcoes.invalidos ?? [] };
    },
  };
  const devices = {
    ativos: async () => {
      contagem.emCurso++;
      contagem.maxEmCurso = Math.max(contagem.maxEmCurso, contagem.emCurso);
      await new Promise((r) => setTimeout(r, 5));
      contagem.emCurso--;
      return celulares;
    },
    tokensDe: async (ids: number[]) => celulares.filter((c) => ids.includes(c.user_id)),
    removerPorToken: async (t: string) => { removidos.push(t); },
  };
  const acesso = { podeVer: async (id: number) => { contagem.podeVer++; return (opcoes.podeVer ?? (() => true))(id); } };
  const config = { paraUsuario: async (id: number) => ({ ...padroes(), ...(opcoes.preferencias?.[id] ?? {}) }) };
  const disponibilidade = { verificar: async (setor: number) => { contagem.verificar++; return { disponivel: opcoes.abertos?.[setor] ?? true }; } };
  const banco = {
    query: async (_sql: string, [id]: number[]) => (opcoes.setores?.[id] ?? []).map((department_id) => ({ department_id })),
  };
  const service = new PushService(envio as never, devices as never, acesso as never, config as never, disponibilidade as never, banco as never);
  return { service, enviados, removidos, contagem };
}

const conversa = (mudancas: Record<string, unknown> = {}) => ({
  id: '42',
  user_id: 1,
  department_id: 10,
  support_chat_status_id: EM_ANDAMENTO,
  contact: { name: 'Ana', last_name: null, remote_jid: '55@s.whatsapp.net', client: { nome: 'Padaria' } },
  ...mudancas,
});
const doCliente = { type: 'chat', content: '*Oi*', from_me: false };

describe('PushService: custo por mensagem', () => {
  it('preferência desligada não consulta acesso nem horário', async () => {
    const { service, contagem } = montar({ preferencias: { 1: { push_mensagem_cliente: false } }, setores: { 1: [10] } });
    await service.avisarMensagem(conversa(), doCliente);
    expect(contagem).toMatchObject({ podeVer: 0, verificar: 0 });
  });

  it('o dono não precisa do horário dos setores (avisa dentro e fora)', async () => {
    const { service, enviados, contagem } = montar({ setores: { 1: [10] }, abertos: { 10: false } });
    await service.avisarMensagem(conversa(), doCliente);
    expect(enviados).toHaveLength(1);
    expect(contagem.verificar).toBe(0);
  });

  it('dois atendentes no mesmo setor: o horário do setor é calculado uma vez', async () => {
    const { service, contagem } = montar({
      celulares: [{ user_id: 2, token: 't2' }, { user_id: 3, token: 't3' }],
      preferencias: { 2: { push_fila: true }, 3: { push_fila: true } },
      setores: { 2: [10], 3: [10] },
    });
    await service.avisarMensagem(conversa({ user_id: null, support_chat_status_id: AGUARDANDO }), doCliente);
    expect(contagem.verificar).toBe(1);
  });

  it('rajada de mensagens: um aviso por vez, sem disputar o banco com a fila do WhatsApp', async () => {
    const { service, enviados, contagem } = montar();
    await Promise.all([1, 2, 3].map(() => service.avisarMensagem(conversa(), doCliente)));
    expect(enviados).toHaveLength(3);
    expect(contagem.maxEmCurso).toBe(1);
  });
});

describe('PushService.avisarMensagem', () => {
  it('mensagem nossa não avisa', async () => {
    const { service, enviados } = montar();
    await service.avisarMensagem(conversa(), { ...doCliente, from_me: true });
    expect(enviados).toEqual([]);
  });

  it('sem o Firebase configurado não faz nada', async () => {
    const { service, enviados } = montar({ ativo: false });
    await service.avisarMensagem(conversa(), doCliente);
    expect(enviados).toEqual([]);
  });

  it('avisa o dono com título do cliente, prévia e id da conversa', async () => {
    const { service, enviados } = montar();
    await service.avisarMensagem(conversa(), doCliente);
    expect(enviados).toEqual([{ tokens: ['t1'], aviso: { titulo: 'Padaria', texto: 'Oi', chatId: 42, tipo: 'mensagem' } }]);
  });

  it('só quem vê a conversa recebe', async () => {
    const { service, enviados } = montar({
      celulares: [{ user_id: 1, token: 't1' }, { user_id: 2, token: 't2' }],
      podeVer: (id) => id === 1,
    });
    await service.avisarMensagem(conversa(), doCliente);
    expect(enviados[0].tokens).toEqual(['t1']);
  });

  it('fila segue a preferência de cada um', async () => {
    const { service, enviados } = montar({
      celulares: [{ user_id: 1, token: 't1' }, { user_id: 2, token: 't2' }],
      preferencias: { 2: { push_fila: true } },
    });
    await service.avisarMensagem(conversa({ user_id: null, support_chat_status_id: AGUARDANDO }), doCliente);
    expect(enviados[0].tokens).toEqual(['t2']);
  });

  it('fora do horário dos setores dele, a fila não avisa', async () => {
    const { service, enviados } = montar({
      preferencias: { 1: { push_fila: true } },
      setores: { 1: [10, 20] },
      abertos: { 10: false, 20: false },
    });
    await service.avisarMensagem(conversa({ user_id: null, support_chat_status_id: AGUARDANDO }), doCliente);
    expect(enviados).toEqual([]);
  });

  it('fora do horário, a conversa dele avisa', async () => {
    const { service, enviados } = montar({ setores: { 1: [10] }, abertos: { 10: false } });
    await service.avisarMensagem(conversa(), doCliente);
    expect(enviados).toHaveLength(1);
  });

  it('ninguém para avisar não chama o Firebase', async () => {
    const { service, enviados } = montar({ podeVer: () => false });
    await service.avisarMensagem(conversa(), doCliente);
    expect(enviados).toEqual([]);
  });

  it('token que o Firebase diz não existir é apagado', async () => {
    const { service, removidos } = montar({ invalidos: ['t1'] });
    await service.avisarMensagem(conversa(), doCliente);
    expect(removidos).toEqual(['t1']);
  });

  it('erro no envio não lança', async () => {
    const { service } = montar();
    (service as unknown as { envio: { enviar: () => Promise<never> } }).envio.enviar = async () => { throw new Error('fora do ar'); };
    await expect(service.avisarMensagem(conversa(), doCliente)).resolves.toBeUndefined();
  });
});

describe('PushService.avisarTransferencia', () => {
  it('avisa só o destino', async () => {
    const { service, enviados } = montar({ celulares: [{ user_id: 1, token: 't1' }, { user_id: 2, token: 't2' }] });
    await service.avisarTransferencia(conversa(), 2);
    expect(enviados).toEqual([{ tokens: ['t2'], aviso: { titulo: 'Conversa transferida para você', texto: 'Padaria', chatId: 42, tipo: 'transferencia' } }]);
  });

  it('respeita a preferência de transferência', async () => {
    const { service, enviados } = montar({ preferencias: { 1: { push_transferencia: false } } });
    await service.avisarTransferencia(conversa(), 1);
    expect(enviados).toEqual([]);
  });
});

describe('mensagemDoAviso', () => {
  it('um aviso por conversa (tag), canal de mensagens e os dados para abrir a conversa', () => {
    expect(mensagemDoAviso('tk', { titulo: 'Padaria', texto: 'Oi', chatId: 42, tipo: 'mensagem' })).toEqual({
      token: 'tk',
      notification: { title: 'Padaria', body: 'Oi' },
      android: { priority: 'high', notification: { tag: 'chat-42', channelId: 'conversas' } },
      // `data.tag`: com o app aberto quem monta o aviso é o expo-notifications,
      // que só troca o anterior pela tag que vem nos dados.
      data: { tipo: 'mensagem', chatId: '42', tag: 'chat-42' },
    });
  });
});
