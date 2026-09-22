import { MailerService } from '@nestjs-modules/mailer';
import { Inject, Injectable, Logger, forwardRef } from '@nestjs/common';
import { createHash } from 'node:crypto';

import { SystemSettingsService } from '@/system-settings/system-settings.service';

export type ConfigEmail = {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
};

export type ResultadoTeste = { ok: boolean; erro?: string };

@Injectable()
export class ConfigMailerService {
  private readonly logger = new Logger(ConfigMailerService.name);

  /** Nome do transporte registrado por último - usado para descartá-lo. */
  private transporteAtual: string | null = null;

  constructor(
    private readonly mailerService: MailerService,
    @Inject(forwardRef(() => SystemSettingsService))
    private readonly settings: SystemSettingsService,
  ) {}

  private async configAtual(): Promise<ConfigEmail> {
    return {
      host: await this.settings.getTexto('email_host'),
      port: await this.settings.getInteiro('email_port'),
      user: await this.settings.getTexto('email_user'),
      pass: await this.settings.getTexto('email_pass'),
      from: await this.settings.getTexto('email_from'),
    };
  }

  /**
   * Garante um transporte registrado para a configuração em vigor e devolve o
   * nome dele.
   *
   * O `MailerModule.forRootAsync` monta o transporte uma vez, na subida do
   * processo - mudar o servidor pela tela não teria efeito. `addTransporter`
   * registra em tempo de execução, e é o que permite a troca sem reiniciar.
   *
   * O nome deriva da própria configuração: mudar host, porta ou usuário produz
   * nome novo, e o antigo é descartado. Sem isso o transporte velho continuaria
   * registrado, e um erro de digitação corrigido na tela seguiria enviando pelo
   * servidor errado.
   */
  private async transporte(config: ConfigEmail): Promise<string> {
    const nome =
      'cfg-' +
      createHash('sha256')
        .update(`${config.host}|${config.port}|${config.user}|${config.pass}`)
        .digest('hex')
        .slice(0, 16);

    if (this.transporteAtual === nome) return nome;

    if (this.transporteAtual) {
      this.mailerService.removeTransporter(this.transporteAtual);
    }

    this.mailerService.addTransporter(nome, {
      host: config.host,
      port: config.port,
      // 465 é SSL do início; 587 começa em claro e sobe para TLS.
      secure: config.port === 465,
      auth: { user: config.user, pass: config.pass },
    });

    this.transporteAtual = nome;
    this.logger.log(`Transporte de e-mail registrado para ${config.host}:${config.port}`);

    return nome;
  }

  /**
   * Envia o link de redefinição de senha.
   *
   * O token vem pronto de quem chama: ele é aleatório e tem o par guardado no
   * banco, então esta classe só o transporta.
   */
  async SendForgottenPassword(
    user_name: string,
    email: string,
    token: string,
    validadeMinutos: number,
  ): Promise<void> {
    // Sem barra no fim, venha a variável com ou sem - concatenar direto
    // produziria `//auth/...`, que alguns servidores tratam como outra rota.
    const base = (process.env.URL_FRONTEND ?? 'http://localhost:3000').replace(/\/+$/, '');
    const url = `${base}/auth/redefinir-senha/${token}`;

    const config = await this.configAtual();

    await this.mailerService.sendMail({
      transporterName: await this.transporte(config),
      from: config.from || undefined,
      to: email,
      subject: 'Redefinição de senha',
      template: 'forgotten_password',
      context: { nome: user_name, url, validade: validadeMinutos },
    });

    this.logger.log(`E-mail de redefinição enviado para ${email}`);
  }

  /**
   * Envia uma mensagem de teste, com credenciais avulsas ou as gravadas.
   *
   * Existe para a configuração ser conferida **antes** de valer: uma senha
   * errada salva em silêncio só apareceria quando alguém tentasse recuperar a
   * própria senha - e aí a recuperação estaria quebrada.
   */
  async testarConexao(
    destinatario: string,
    parciais: Partial<ConfigEmail> = {},
  ): Promise<ResultadoTeste> {
    const gravada = await this.configAtual();
    const config: ConfigEmail = { ...gravada, ...limpaVazios(parciais) };

    if (!config.host || !config.user) {
      return { ok: false, erro: 'Servidor e usuário precisam estar preenchidos.' };
    }

    // Transporte descartável, com nome próprio: usar o `transporte()` faria o
    // teste substituir a configuração em vigor antes de saber se ela presta.
    const nome = `teste-${Date.now()}`;

    try {
      this.mailerService.addTransporter(nome, {
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: { user: config.user, pass: config.pass },
      });

      await this.mailerService.sendMail({
        transporterName: nome,
        from: config.from || undefined,
        to: destinatario,
        subject: 'Teste de configuração de e-mail',
        // Template, não `text`: o adaptador Handlebars é aplicado a todo
        // transporte registrado e falha quando não encontra um - o erro que
        // aparecia era do adaptador, mascarando a causa real da recusa.
        template: 'teste_configuracao',
        context: { host: config.host, port: config.port, user: config.user },
      });

      return { ok: true };
    } catch (err) {
      return { ok: false, erro: err?.message ?? 'Não foi possível enviar.' };
    } finally {
      this.mailerService.removeTransporter(nome);
    }
  }

  /** Descarta o transporte em uso, forçando a releitura na próxima mensagem. */
  invalidaTransporte(): void {
    if (this.transporteAtual) {
      this.mailerService.removeTransporter(this.transporteAtual);
      this.transporteAtual = null;
    }
  }
}

/** Campos vazios não sobrescrevem o que está gravado. */
const limpaVazios = (o: Partial<ConfigEmail>): Partial<ConfigEmail> =>
  Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as Partial<ConfigEmail>;
