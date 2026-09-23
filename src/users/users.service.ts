import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  Scope,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { randomUUID } from 'node:crypto';

import { PermissionsRepository } from 'permissions/permissions.repository';
import { PermissionService } from '@/permissions/permission.service';
import { PresignedUpload, StorageService } from 'storage/storage.service';
import { CreateUserDto } from './dto/create-user.dto';
import { SignAvatarDto } from './dto/sign-avatar.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PreferenciasTemaDto } from './dto/preferencias-tema.dto';
import { Users } from './entities/users.entity';
import { UserRepository } from './users.repository';
import { RedisCacheRepository } from '@/redis-cache/redis-cache.repository';
import { UserConfigService } from '@/user-config/user-config.service';

@Injectable({ scope: Scope.REQUEST })
export class UsersService {
  private query: QueryRunner;
  private readonly logger = new Logger(UsersService.name);
  constructor(
    private readonly redisCacheRepository: RedisCacheRepository,
    private readonly usersRepository: UserRepository,
    private readonly permissionsRepository: PermissionsRepository,
    private readonly permissionService: PermissionService,
    private readonly storageService: StorageService,
    private readonly userConfigService: UserConfigService,
    private dataSource: DataSource,
  ) {
    this.query = this.dataSource.createQueryRunner();
  }

  async findAll(): Promise<Users[]> {
    const users = await this.usersRepository.findActives();
    return users;
  }

  async findOne(id: number): Promise<Users> {
    const user = await this.usersRepository.findById(id);

    const userWithAvatar = await this.getUserWithURLAvatar(user);

    return userWithAvatar;
  }

  async signAvatar(signAvatarDto: SignAvatarDto): Promise<PresignedUpload> {
    try {
      let user: Users;
      let avatarName: string;

      if (signAvatarDto?.user_id) {
        user = await this.usersRepository.findById(signAvatarDto.user_id);
      }

      // Reaproveitar a key só faz sentido se já existir uma: usuário sem avatar
      // (ou com o campo limpo) precisa de key nova, senão a URL assinada sai
      // apontando para "null" e o upload falha.
      if (user?.avatar_url) {
        avatarName = user.avatar_url;
      } else {
        avatarName = `${signAvatarDto.key}/${randomUUID()}.${signAvatarDto.fileType.split('/')[1]}`;
      }

      const avatar_url = await this.storageService.createPresignedPost(
        avatarName,
        signAvatarDto.fileType,
      );

      return avatar_url;
    } catch (err) {
      this.logger.error(err.message);
      throw err;
    }
  }

  async addUser(createUserDto: CreateUserDto): Promise<Users> {
    await this.recusaEmailEmUso(createUserDto.email);

    try {
      await this.query.startTransaction();

      const newUser = await this.usersRepository.createUser(createUserDto, this.query.manager);
      delete newUser.password;
      await this.query.commitTransaction();

      return newUser;
    } catch (err) {
      await this.query.rollbackTransaction();
      this.logger.error(err.message);
      throw err;
    }
  }

  async updateUser(
    user_id: number,
    updateUserDto: UpdateUserDto,
    solicitante?: Users,
  ): Promise<Users> {
    await this.recusaSeSuperusuario(user_id, 'alterado');

    if (solicitante) {
      await this.recusaCamposSemPermissao(user_id, updateUserDto, solicitante);
    }

    if (updateUserDto.email) {
      await this.recusaEmailEmUso(updateUserDto.email, user_id);
    }

    try {
      await this.query.startTransaction();
      const user = await this.usersRepository.findById(user_id);

      // Só apaga se houver o que apagar: `deleteObject` com key vazia falha no
      // SDK ("No value provided for input HTTP label: Key") e derruba a
      // atualização inteira com 500 - um usuário sem avatar não podia ser
      // editado.
      if (!updateUserDto.avatar_url && user.avatar_url) {
        await this.storageService.deleteObject(user.avatar_url);
        await this.redisCacheRepository.del(`presigned:user:${user.id}:avatar`);
      }
      
      if (updateUserDto.changed_avatar) {
        await this.redisCacheRepository.del(`presigned:user:${user.id}:avatar`);
      }

      const updatedUser = await this.usersRepository.updateUser(
        user_id,
        updateUserDto,
        this.query.manager,
      );
      delete updatedUser.password;
      await this.query.commitTransaction();

      // Trocar o grupo muda o que o usuário pode fazer; o guard tem cache de
      // 30s, e sem isto o acesso antigo seguiria valendo por meio minuto.
      if (updateUserDto.permission_group_id !== undefined) {
        this.permissionService.invalida(user_id);
      }

      return updatedUser;
    } catch (err) {
      await this.query.rollbackTransaction();
      throw err;
    }
  }

  async deleteUser(user_id: number): Promise<Users> {
    // Fora da transação, antes de qualquer escrita: excluir o superusuário
    // deixaria o sistema sem quem administra, e ele nem aparece na tela - quem
    // chegasse aqui teria descoberto o id por outro caminho.
    await this.recusaSeSuperusuario(user_id, 'removido');

    try {
      await this.query.startTransaction();

      const updatedUser = await this.usersRepository.deleteUser(user_id, this.query.manager);

      // Mesmo motivo do `updateUser`: sem avatar não há objeto a remover, e
      // chamar assim mesmo fazia a exclusão falhar com 500.
      if (updatedUser.avatar_url) {
        await this.storageService.deleteObject(updatedUser.avatar_url);
        await this.redisCacheRepository.del(`presigned:user:${updatedUser.id}:avatar`);
      }

      delete updatedUser.password;
      await this.query.commitTransaction();

      return updatedUser;
    } catch (err) {
      await this.query.rollbackTransaction();
      throw err;
    }
  }

  /**
   * Recusa e-mail já usado por outro cadastro.
   *
   * O login busca o usuário **pelo e-mail** e usa o primeiro que encontrar:
   * com dois registros iguais, quem entra depende da ordem física da tabela, e
   * a senha correta de um deles passa a ser recusada. Havia duplicata até
   * mesmo do usuário master, porque nada verificava - nem aqui, nem no banco.
   */
  private async recusaEmailEmUso(email: string, ignorarId?: number): Promise<void> {
    if (await this.usersRepository.emailEmUso(email, ignorarId)) {
      throw new ConflictException(`Já existe um usuário com o e-mail "${email}".`);
    }
  }

  /**
   * Barra alterações no superusuário vindas da tela de cadastro.
   *
   * Ele é a conta de instalação: passa por qualquer permissão pelo desvio do
   * guard, e por isso não está na listagem. Sem esta checagem, bastava saber o
   * id para desativá-lo pela API e deixar o sistema sem administrador.
   *
   * Não impede o próprio usuário de mexer nos seus dados por outros caminhos -
   * é especificamente o CRUD de usuários que fica de fora.
   */
  /**
   * Barra os campos de alcance maior quando a pessoa edita a si mesma.
   *
   * O e-mail é a credencial de login e o grupo define o que se pode fazer -
   * sem isto, qualquer um com `user:update` se promoveria a administrador
   * trocando o próprio grupo.
   *
   * ⚠️ **Só vale para auto-edição.** Alterar o e-mail ou o grupo de *outro*
   * usuário segue sob `user:update`, que o handler já exige: quem administra
   * usuários tem esse poder por definição, e exigir as duas faria um
   * administrador não conseguir promover ninguém.
   *
   * O superusuário passa direto, como no `PermissionGuard` - o
   * `hasPermission` sozinho não o cobre, a checagem vive no guard.
   */
  private async recusaCamposSemPermissao(
    user_id: number,
    dto: UpdateUserDto,
    solicitante: Users,
  ): Promise<void> {
    const editandoOutro = Number(solicitante.id) !== Number(user_id);
    if (editandoOutro || solicitante.is_superuser) return;

    const atual = await this.usersRepository.findById(user_id);

    // Só quando o valor muda de fato: reenviar o mesmo e-mail é o que o
    // formulário faz a cada salvamento, e recusar isso impediria a pessoa de
    // trocar o próprio avatar.
    if (dto.email && dto.email !== atual.email) {
      const pode = await this.permissionService.hasPermission(solicitante.id, [
        'user:change_own_email',
      ]);

      if (!pode) {
        throw new UnauthorizedException('Você não tem permissão para alterar o próprio e-mail');
      }
    }

    const trocouGrupo =
      dto.permission_group_id !== undefined &&
      Number(dto.permission_group_id ?? 0) !== Number(atual.permission_group_id ?? 0);

    if (trocouGrupo) {
      const pode = await this.permissionService.hasPermission(solicitante.id, [
        'user:change_group',
      ]);

      if (!pode) {
        throw new UnauthorizedException(
          'Você não tem permissão para alterar o grupo de permissão',
        );
      }
    }
  }

  private async recusaSeSuperusuario(user_id: number, acao: string): Promise<void> {
    const alvo = await this.usersRepository.findById(user_id);

    if (alvo?.is_superuser) {
      throw new ForbiddenException(
        `O usuário master do sistema não pode ser ${acao} por aqui.`,
      );
    }
  }

  async userInfo(user_id: number) {
    const user = await this.usersRepository.findById(user_id);
    const userWithAvatar = await this.getUserWithURLAvatar(user);

    // Só os nomes, não os registros inteiros.
    //
    // O front guarda esta resposta no cookie `userInfo`, e cookie tem teto de
    // 4 KB. Com `id`, `label` e `permission_module_id` juntos, 45 permissões
    // davam 4,5 KB: o navegador recusava gravar em silêncio, o middleware
    // achava o cookie ausente, chamava de novo - e o portal entrava em laço de
    // redirecionamento. Só os nomes cabem em 1,3 KB.
    //
    // O `label` e o módulo são usados apenas na tela de papéis, que os busca
    // do catálogo completo em `/permissions`.
    const permissions = (await this.permissionsRepository.permissionByUser(user_id)).map(
      (p) => p.name,
    );

    // As preferências vêm junto: o cookie `userInfo` é o que reabastece o
    // cookie `tema` em máquina nova, e o front lê as de notificação daqui sem
    // uma segunda chamada. Cabem folgado nos 4 KB - são duas strings curtas e
    // quatro booleanos.
    const preferencias = await this.userConfigService.paraUsuario(user_id);

    return { ...userWithAvatar, permissions, ...preferencias };
  }

  /**
   * Grava a preferência de tema de quem está logado.
   *
   * O `user_id` vem sempre do token, nunca do corpo: no sistema que serviu de
   * referência ele vinha do body, e qualquer autenticado podia sobrescrever a
   * preferência de outro.
   *
   * Rota própria, separada do `update` de usuário, porque as validações são
   * outras — lá um campo inválido do cadastro impediria salvar o tema, que foi
   * exatamente o que aconteceu no sistema de referência (um CNPJ errado
   * bloqueava a troca de cor).
   */
  async atualizaPreferenciasTema(
    user_id: number,
    dto: PreferenciasTemaDto,
  ): Promise<{ tema: string | null; modo_tema: string | null }> {
    // Omitir preserva: o toggle de modo manda só `modo_tema`, e os cards só a
    // cor. Mandar as duas sempre sobrescreveria a outra metade da escolha.
    const aGravar: Record<string, string> = {};

    if (dto.tema) aGravar.tema = dto.tema;
    if (dto.modo_tema) aGravar.modo_tema = dto.modo_tema;

    // A rota continua existindo, mas o armazenamento mudou: tema deixou de ser
    // coluna de `users` e virou preferência em `user_config` (ver a migration
    // `1789600000001`). Mantê-la evita mexer no `useTema` do front junto com a
    // troca de formato.
    const preferencias = Object.keys(aGravar).length
      ? await this.userConfigService.atualizar(user_id, aGravar)
      : await this.userConfigService.paraUsuario(user_id);

    this.logger.log(`Tema do usuário ${user_id}: ${preferencias.tema}/${preferencias.modo_tema}`);

    return {
      tema: String(preferencias.tema),
      modo_tema: String(preferencias.modo_tema),
    };
  }

  /**
   * O bucket é público: a URL é permanente, então não há assinatura a gerar
   * nem cache a manter.
   */
  async getUserWithURLAvatar(user: Users): Promise<Users> {
    if (user.avatar_url) {
      user.avatar_url = this.storageService.getPublicUrl(user.avatar_url);
    }

    return user;
  }
}
