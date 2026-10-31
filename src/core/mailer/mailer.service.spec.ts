import { ConfigMailerService } from './configmailer.service';

jest.mock('@/system-settings/system-settings.service', () => ({ SystemSettingsService: class {} }));
jest.mock('@nestjs-modules/mailer', () => ({ MailerService: class {} }));

describe('Envio de e-mail com SMTP ou Resend', () => {
  const ambiente = { EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
    RESEND_API_KEY: process.env.RESEND_API_KEY, RESEND_FROM: process.env.RESEND_FROM };

  beforeEach(() => {
    process.env.EMAIL_PROVIDER = 'smtp';
    process.env.RESEND_API_KEY = 'chave-ficticia';
    process.env.RESEND_FROM = 'Automatec <nao-responda@empresa.test>';
  });

  afterAll(() => {
    for (const [chave, valor] of Object.entries(ambiente)) {
      if (valor === undefined) delete process.env[chave];
      else process.env[chave] = valor;
    }
  });

  function preparar() {
    const emailBanco = { email_host: 'smtp.gmail.com', email_user: 'conta@gmail.com',
      email_pass: 'senha-smtp-preservada', email_from: 'Conta <conta@gmail.com>' };
    const settings = { getTexto: jest.fn(async (chave: string) => emailBanco[chave]),
      getInteiro: jest.fn(async () => 587) };
    const mailer = { addTransporter: jest.fn(), removeTransporter: jest.fn(), sendMail: jest.fn() };
    const servico = new ConfigMailerService(mailer as never, settings as never);
    return { servico, mailer, settings };
  }

  it('preserva o SMTP do banco quando o provedor é smtp', async () => {
    const { servico, mailer } = preparar();
    await servico.SendConviteUsuario('destino@empresa.test', 'token', 60);
    expect(mailer.addTransporter).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      host: 'smtp.gmail.com', port: 587, secure: false,
      auth: { user: 'conta@gmail.com', pass: 'senha-smtp-preservada' },
    }));
    expect(mailer.sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'Conta <conta@gmail.com>' }));
  });

  it('mantém compatibilidade quando EMAIL_PROVIDER não foi definido', async () => {
    delete process.env.EMAIL_PROVIDER;
    const { servico, mailer } = preparar();
    await servico.SendConviteUsuario('destino@empresa.test', 'token', 60);
    expect(mailer.addTransporter.mock.calls[0][1].host).toBe('smtp.gmail.com');
  });

  it('envia pelo Resend sem ler ou modificar as credenciais do banco', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    const { servico, mailer, settings } = preparar();
    await servico.SendConviteUsuario('destino@empresa.test', 'token', 60);
    expect(mailer.addTransporter).toHaveBeenCalledWith(expect.any(String), {
      host: 'smtp.resend.com', port: 465, secure: true,
      auth: { user: 'resend', pass: 'chave-ficticia' },
    });
    expect(mailer.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'Automatec <nao-responda@empresa.test>', template: 'convite_usuario',
    }));
    expect(settings.getTexto).not.toHaveBeenCalled();
    expect(settings.getInteiro).not.toHaveBeenCalled();
  });

  it('preserva o template de recuperação de senha no Resend', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    const { servico, mailer } = preparar();
    await servico.SendForgottenPassword('Pessoa', 'destino@empresa.test', 'token', 30);
    expect(mailer.sendMail).toHaveBeenCalledWith(expect.objectContaining({
      template: 'forgotten_password', context: expect.objectContaining({ nome: 'Pessoa', validade: 30 }),
    }));
  });

  it.each(['RESEND_API_KEY', 'RESEND_FROM'])('não recorre ao Gmail quando falta %s', async (chave) => {
    process.env.EMAIL_PROVIDER = 'resend';
    delete process.env[chave];
    const { servico, mailer } = preparar();
    await expect(servico.SendConviteUsuario('destino@empresa.test', 'token', 60)).rejects.toThrow('Configure RESEND_API_KEY e RESEND_FROM');
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  it('recusa um provedor inválido sem tentar enviar pelo Gmail', async () => {
    process.env.EMAIL_PROVIDER = 'invalido';
    const { servico, mailer } = preparar();
    await expect(servico.SendConviteUsuario('destino@empresa.test', 'token', 60)).rejects.toThrow('EMAIL_PROVIDER');
    expect(mailer.sendMail).not.toHaveBeenCalled();
  });

  it('troca para SMTP sem perder a configuração salva', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    const { servico, mailer } = preparar();
    await servico.SendConviteUsuario('destino@empresa.test', 'token', 60);
    process.env.EMAIL_PROVIDER = 'smtp';
    await servico.SendConviteUsuario('destino@empresa.test', 'token', 60);
    expect(mailer.addTransporter.mock.calls[1][1].host).toBe('smtp.gmail.com');
    expect(mailer.removeTransporter).toHaveBeenCalled();
  });

  it('o teste sem credenciais usa o Resend ativo e não expõe a chave no template', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    const { servico, mailer } = preparar();
    expect(await servico.testarConexao('destino@empresa.test')).toEqual({ ok: true });
    expect(mailer.sendMail.mock.calls[0][0].context).toEqual({ host: 'smtp.resend.com', port: 465, user: 'resend' });
  });

  it('o formulário pode testar o SMTP salvo sem misturar a chave do Resend', async () => {
    process.env.EMAIL_PROVIDER = 'resend';
    const { servico, mailer } = preparar();
    await servico.testarConexao('destino@empresa.test', { host: 'smtp.gmail.com', port: 587 });
    expect(mailer.addTransporter.mock.calls[0][1].auth.pass).toBe('senha-smtp-preservada');
  });
});
