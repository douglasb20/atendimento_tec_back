import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource } from 'typeorm';

import { ConfigMailerService } from 'core/mailer/configmailer.service';
import { UserRefreshTokens } from '@/users/entities/user-refresh-tokens.entity';
import { Users } from '@/users/entities/users.entity';
import { UserRepository } from '@/users/users.repository';
import { runInTransaction } from 'Utils';
import { SystemSettingsService } from '@/system-settings/system-settings.service';
import { PasswordResets } from './entities/password-resets.entity';
import { PasswordResetRepository } from './password-reset.repository';

/** Por que um pedido não vale — o front usa isto para explicar ao usuário. */
export type MotivoInvalido = 'invalido' | 'expirado' | 'usado';

export type ResultadoValidacao = { valido: boolean; motivo?: MotivoInvalido };

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly passwordResetRepository: PasswordResetRepository,
    private readonly usersRepository: UserRepository,
    private readonly mailerService: ConfigMailerService,
    private readonly settings: SystemSettingsService,
    private readonly dataSource: DataSource,
  ) {}

  /** Minutos de validade do link, configurável pelo portal. */
  private validadeMinutos(): Promise<number> {
    return this.settings.getInteiro('reset_senha_expiracao_min');
  }

  /**
   * O que é gravado no banco.
   *
   * SHA-256 basta aqui, e bcrypt seria errado: o token já tem 256 bits de
   * entropia, então não há o que proteger contra força bruta — o custo do
   * bcrypt existe para senhas humanas, que são curtas e previsíveis.
   */
  private hashDoToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Cria o pedido e envia o e-mail.
   *
   * Responde 404 quando o e-mail não existe, por decisão de produto: o portal é
   * interno, e avisar ajuda quem digitou errado. A contrapartida é permitir
   * descobrir quais endereços têm conta, um por vez.
   */
  async solicitar(email: string): Promise<void> {
    const user = await this.usersRepository.findOne({
      where: { email, status: 1 },
      select: ['id', 'name', 'email'],
    });

    if (!user) {
      throw new NotFoundException('Não encontramos uma conta com esse e-mail.');
    }

    const token = randomBytes(32).toString('hex');
    const minutos = await this.validadeMinutos();
    const expiraEm = new Date(Date.now() + minutos * 60 * 1000);

    await runInTransaction(this.dataSource, async (manager) => {
      // Antes de criar o novo: dois links válidos ao mesmo tempo confundem, e o
      // usuário costuma usar o mais antigo, que ficou visível no e-mail acima.
      await this.passwordResetRepository.invalidaPendentes(user.id, manager);

      await manager.save(
        manager.create(PasswordResets, {
          user_id: user.id,
          token_hash: this.hashDoToken(token),
          expires_at: expiraEm,
        }),
      );
    });

    // Fora da transação: o e-mail sai depois do commit, senão um envio bem
    // sucedido poderia acompanhar um pedido que acabou revertido.
    await this.mailerService.SendForgottenPassword(user.name, user.email, token, minutos);

    this.logger.log(`Pedido de redefinição criado para o usuário ${user.id}`);
  }

  /**
   * O link ainda serve?
   *
   * Existe para a tela não pedir a senha nova e só então descobrir que o prazo
   * passou — o usuário digitaria duas vezes para nada.
   */
  async validar(token: string): Promise<ResultadoValidacao> {
    const pedido = await this.passwordResetRepository.findByTokenHash(this.hashDoToken(token));

    if (!pedido) return { valido: false, motivo: 'invalido' };
    if (pedido.used_at) return { valido: false, motivo: 'usado' };
    if (pedido.expires_at.getTime() < Date.now()) return { valido: false, motivo: 'expirado' };

    return { valido: true };
  }

  /** Grava a senha nova, consome o pedido e derruba as sessões abertas. */
  async redefinir(token: string, password: string): Promise<void> {
    const pedido = await this.passwordResetRepository.findByTokenHash(this.hashDoToken(token));

    if (!pedido || pedido.used_at || pedido.expires_at.getTime() < Date.now()) {
      // Uma mensagem só para os três casos: quem chega aqui com token inválido
      // não precisa saber se ele nunca existiu, se venceu ou se já foi usado. A
      // tela consulta `validar` antes e dá o motivo a quem veio pelo link certo.
      throw new BadRequestException(
        'Este link não é mais válido. Peça uma nova redefinição de senha.',
      );
    }

    await runInTransaction(this.dataSource, async (manager) => {
      // `trocaSenha`, não `updateUser`: aquele exige o DTO completo e reescreve
      // o registro inteiro. Aqui só a senha muda, e o manager é o da transação
      // para ela e o consumo do pedido caírem juntos.
      await this.usersRepository.trocaSenha(pedido.user_id, password, manager);

      await this.passwordResetRepository.marcaComoUsado(pedido.id, manager);

      // Quem redefine a senha porque desconfia de invasão espera que as sessões
      // abertas caiam. Sem isto, um refresh roubado continua valendo por 30 dias.
      await manager.delete(UserRefreshTokens, { user_id: pedido.user_id });

      // A flag existe desde o cadastro original e era escrita sem nunca voltar
      // a zero. Como agora há um fluxo que conclui, zerar aqui a deixa coerente.
      await manager.update(Users, pedido.user_id, { is_requestpassword: 0 });
    });

    this.logger.log(`Senha redefinida para o usuário ${pedido.user_id}`);
  }
}
