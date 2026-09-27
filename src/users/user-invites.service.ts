import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';

import { ConfigMailerService } from 'core/mailer/configmailer.service';
import { SystemSettingsService } from '@/system-settings/system-settings.service';
import { runInTransaction } from 'Utils';
import { Users } from './entities/users.entity';
import { UserInvites } from './entities/user-invites.entity';
import { UserInvitesRepository } from './user-invites.repository';
import { UserRepository } from './users.repository';

/** Por que um convite não vale - o front usa isto para explicar ao convidado. */
export type MotivoInvalido = 'invalido' | 'expirado' | 'usado';

export type ResultadoValidacao = { valido: boolean; motivo?: MotivoInvalido };

export type StatusConvite = 'pendente' | 'aceito';

@Injectable()
export class UserInvitesService {
  private readonly logger = new Logger(UserInvitesService.name);

  constructor(
    private readonly userInvitesRepository: UserInvitesRepository,
    private readonly usersRepository: UserRepository,
    private readonly mailerService: ConfigMailerService,
    private readonly settings: SystemSettingsService,
    private readonly dataSource: DataSource,
  ) {}

  /** Minutos de validade do link, configurável pelo portal. */
  private validadeMinutos(): Promise<number> {
    return this.settings.getInteiro('convite_usuario_expiracao_min');
  }

  /**
   * O que é gravado no banco.
   *
   * SHA-256 basta aqui, e bcrypt seria errado: o token já tem 256 bits de
   * entropia, então não há o que proteger contra força bruta - o custo do
   * bcrypt existe para senhas humanas, que são curtas e previsíveis.
   */
  private hashDoToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Cria o convite dentro da transação de quem chama (o cadastro do usuário).
   *
   * Não envia o e-mail: quem chama ainda pode reverter a transação, e um
   * envio bem sucedido não pode acompanhar um cadastro que não foi para a
   * frente. `criarEEnviar` é quem faz as duas coisas, para o caso comum de
   * cadastro isolado.
   */
  async criar(user_id: number, manager: EntityManager): Promise<{ token: string }> {
    const token = randomBytes(32).toString('hex');
    const minutos = await this.validadeMinutos();
    const expiraEm = new Date(Date.now() + minutos * 60 * 1000);

    await manager.save(
      manager.create(UserInvites, {
        user_id,
        token_hash: this.hashDoToken(token),
        expires_at: expiraEm,
      }),
    );

    return { token };
  }

  /** Envia (ou reenvia) o e-mail de convite para um token já gravado. */
  async enviarConvite(email: string, token: string): Promise<void> {
    const minutos = await this.validadeMinutos();
    await this.mailerService.SendConviteUsuario(email, token, minutos);
  }

  /**
   * Reenvia: invalida o pendente anterior, cria outro e manda e-mail de novo.
   */
  async reenviar(user_id: number): Promise<{ url: string }> {
    const user = await this.usersRepository.findById(user_id);

    const { token } = await runInTransaction(this.dataSource, async (manager) => {
      await this.userInvitesRepository.invalidaPendentes(user_id, manager);
      return this.criar(user_id, manager);
    });

    await this.enviarConvite(user.email, token);

    this.logger.log(`Convite reenviado para o usuário ${user_id}`);

    return { url: this.montaUrl(token) };
  }

  /**
   * Devolve o link do convite sem enviar e-mail - para o admin copiar e
   * mandar por outro canal.
   *
   * Como só o hash do token fica gravado, um convite já emitido não tem como
   * ter seu token em claro recuperado depois: por isso este método sempre
   * gera um convite novo, invalidando o anterior - o mesmo que `reenviar`
   * faz, só sem o e-mail.
   */
  async gerarLink(user_id: number): Promise<{ url: string }> {
    const { token } = await runInTransaction(this.dataSource, async (manager) => {
      await this.userInvitesRepository.invalidaPendentes(user_id, manager);
      return this.criar(user_id, manager);
    });

    return { url: this.montaUrl(token) };
  }

  private montaUrl(token: string): string {
    const base = (process.env.URL_FRONTEND ?? 'http://localhost:3000').replace(/\/+$/, '');
    return `${base}/auth/aceitar-convite/${token}`;
  }

  /**
   * O link ainda serve?
   *
   * Existe para a tela não pedir nome/senha e só então descobrir que o prazo
   * passou.
   */
  async validar(token: string): Promise<ResultadoValidacao> {
    const convite = await this.userInvitesRepository.findByTokenHash(this.hashDoToken(token));

    if (!convite) return { valido: false, motivo: 'invalido' };
    if (convite.used_at) return { valido: false, motivo: 'usado' };
    if (convite.expires_at.getTime() < Date.now()) return { valido: false, motivo: 'expirado' };

    return { valido: true };
  }

  /** Grava nome/sobrenome/senha do convidado e consome o convite. */
  async aceitar(
    token: string,
    dados: { name: string; last_name?: string | null; password: string },
  ): Promise<void> {
    const convite = await this.userInvitesRepository.findByTokenHash(this.hashDoToken(token));

    if (!convite || convite.used_at || convite.expires_at.getTime() < Date.now()) {
      throw new BadRequestException('Este convite não é mais válido. Peça um novo à sua empresa.');
    }

    await runInTransaction(this.dataSource, async (manager) => {
      await manager.update(Users, convite.user_id, {
        name: dados.name,
        last_name: dados.last_name || null,
      });

      await this.usersRepository.trocaSenha(convite.user_id, dados.password, manager);
      await this.userInvitesRepository.marcaComoUsado(convite.id, manager);
    });

    this.logger.log(`Convite aceito pelo usuário ${convite.user_id}`);
  }

  /**
   * Status por usuário, para a listagem: pendente (convite válido em aberto)
   * ou aceito (usado, vencido, ou nunca existiu - fluxo antigo).
   */
  async statusPorUsuarios(user_ids: number[]): Promise<Map<number, StatusConvite>> {
    const convites = await this.userInvitesRepository.maisRecentePorUsuarios(user_ids);
    const status = new Map<number, StatusConvite>();

    for (const convite of convites) {
      const pendente = !convite.used_at && convite.expires_at.getTime() >= Date.now();
      status.set(convite.user_id, pendente ? 'pendente' : 'aceito');
    }

    return status;
  }
}
