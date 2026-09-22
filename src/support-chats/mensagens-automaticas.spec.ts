import { montaMensagemAutomatica } from '@/support-chats/mensagens-automaticas';
import { SupportChats } from '@/support-chats/entities/support-chats.entity';

const chat = {
  protocol: '2026090000012',
  contact: {
    name: 'Maria',
    last_name: 'Silva',
    phone: '5564992698043',
    client: { nome: 'Automatec', cnpj: '12345678000190' },
  },
  channel: { name: 'Suporte' },
  user: { name: 'Douglas', last_name: 'A. Silva' },
} as unknown as SupportChats;

describe('montaMensagemAutomatica', () => {
  it('troca as variáveis conhecidas', () => {
    expect(montaMensagemAutomatica('Olá {{nome}}, protocolo {{protocolo}}', chat)).toBe(
      'Olá Maria, protocolo 2026090000012',
    );
  });

  // ⚠️ `{{nome}}` é o primeiro nome desde a separação das colunas; quem quer o
  // inteiro usa `{{nome_completo}}`.
  it('distingue primeiro nome, sobrenome e nome completo', () => {
    expect(
      montaMensagemAutomatica('{{nome}} | {{sobrenome}} | {{nome_completo}}', chat),
    ).toBe('Maria | Silva | Maria Silva');
  });

  it('resolve os dados do atendente', () => {
    expect(
      montaMensagemAutomatica(
        '{{atendente}} | {{atendente_sobrenome}} | {{atendente_nome_completo}}',
        chat,
      ),
    ).toBe('Douglas | A. Silva | Douglas A. Silva');
  });

  it('formata o CNPJ do cliente', () => {
    expect(montaMensagemAutomatica('{{cnpj}}', chat)).toBe('12.345.678/0001-90');
  });

  // Contato de uma palavra só: o sobrenome fica vazio e o completo não ganha
  // espaço sobrando no fim.
  it('lida com contato sem sobrenome', () => {
    const semSobrenome = {
      ...chat,
      contact: { name: 'Rayene', last_name: null },
    } as unknown as SupportChats;

    expect(montaMensagemAutomatica('[{{nome_completo}}][{{sobrenome}}]', semSobrenome)).toBe(
      '[Rayene][]',
    );
  });

  // A saudação é enviada na abertura, quando ninguém assumiu a conversa.
  it('deixa o atendente vazio quando a conversa não tem dono', () => {
    const semDono = { ...chat, user: null } as unknown as SupportChats;

    expect(montaMensagemAutomatica('Oi {{nome}}, sou {{atendente}}.', semDono)).toBe(
      'Oi Maria, sou .',
    );
  });

  it('formata o telefone e resolve cliente e canal', () => {
    expect(montaMensagemAutomatica('{{telefone}} | {{cliente}} | {{canal}}', chat)).toBe(
      '(64) 9 9269-8043 | Automatec | Suporte',
    );
  });

  it('tolera espaços dentro das chaves', () => {
    expect(montaMensagemAutomatica('Oi {{ nome }}', chat)).toBe('Oi Maria');
  });

  // O caso que não pode quebrar: contato sem cliente é o normal.
  it('troca por vazio o que não existe, sem lançar', () => {
    const semCliente = { ...chat, contact: { name: 'João', phone: null } } as unknown as SupportChats;
    expect(montaMensagemAutomatica('Oi {{nome}}, cliente: {{cliente}}.', semCliente)).toBe(
      'Oi João, cliente: .',
    );
  });

  it('variável inexistente vira vazio em vez de erro', () => {
    expect(montaMensagemAutomatica('Oi {{nomee}}!', chat)).toBe('Oi !');
  });

  it('devolve null quando não há texto', () => {
    expect(montaMensagemAutomatica(null, chat)).toBeNull();
    expect(montaMensagemAutomatica('   ', chat)).toBeNull();
  });

  it('devolve null quando só restam variáveis vazias', () => {
    const vazio = { contact: {}, channel: {} } as unknown as SupportChats;
    expect(montaMensagemAutomatica('{{cliente}}', vazio)).toBeNull();
  });

  it('a saudação varia com o horário', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-21T09:00:00'));
    expect(montaMensagemAutomatica('{{saudacao}}!', chat)).toBe('Bom dia!');
    jest.setSystemTime(new Date('2026-09-21T14:00:00'));
    expect(montaMensagemAutomatica('{{saudacao}}!', chat)).toBe('Boa tarde!');
    jest.setSystemTime(new Date('2026-09-21T20:00:00'));
    expect(montaMensagemAutomatica('{{saudacao}}!', chat)).toBe('Boa noite!');
    jest.useRealTimers();
  });
});
