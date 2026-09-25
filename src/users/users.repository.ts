import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Users } from './entities/users.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserRepository extends Repository<Users> {
  private readonly logger = new Logger(UserRepository.name);
  constructor(dataSource: DataSource) {
    super(Users, dataSource.manager);
  }

  /**
   * Usuários da tela de cadastro.
   *
   * O superusuário fica **de fora**: ele é a conta de instalação do sistema,
   * não um atendente, e aparecer na lista só criaria a tentação de editá-lo ou
   * removê-lo - o que deixaria o sistema sem quem administra, já que ele passa
   * por qualquer permissão pelo desvio do guard.
   *
   * O filtro é aqui, e não na tela: escondê-lo apenas no front deixaria a API
   * devolvendo os dados dele a quem chamasse `/users` direto.
   *
   * Ele continua existindo normalmente no resto do sistema - entra, atende,
   * assina o que faz. `findById` não filtra, senão o próprio login quebraria.
   */
  async findActives() {
    // `permissionGroup` e `departments` carregadas para a listagem mostrar o
    // grupo e os setores de cada um.
    return this.find({
      where: [
        { status: 1, is_superuser: 0 },
        // `IsNull` porque a coluna é anulável: um cadastro antigo pode ter
        // `NULL` em vez de 0, e `is_superuser: 0` sozinho o excluiria da lista.
        { status: 1, is_superuser: IsNull() },
      ],
      relations: ['permissionGroup', 'departments'],
    });
  }

  /**
   * E-mail já usado por outro usuário? A comparação ignora maiúsculas.
   *
   * Inclui os inativos: o cadastro é reativado, não recriado, e permitir o
   * mesmo e-mail em dois registros faria o login escolher um deles pela ordem
   * física da tabela - inclusive negando a senha certa do outro.
   */
  async emailEmUso(email: string, ignorarId?: number): Promise<boolean> {
    const query = this.createQueryBuilder('u').where('lower(u.email) = lower(:email)', { email });

    if (ignorarId) {
      query.andWhere('u.id != :ignorarId', { ignorarId });
    }

    return query.getExists();
  }

  async findById(id: number) {
    const user = await this.findOne({
      where: { id: id, status: 1 },
      relations: ['permissionGroup'],
    });
    if (!user) {
      this.logger.error(`Erro de atualizar usuário: Usuário não localizado com este id`);
      throw new BadRequestException('Usuário não localizado com este id');
    }
    return user;
  }

  async createUser(user: CreateUserDto, manager: EntityManager) {
    const newUser = this.create({
      ...user,
      password: await bcrypt.hash(user.password, 10),
    });
    return await manager.save(Users, newUser);
  }

  /**
   * Grava só a senha, já com hash.
   *
   * Existe separado do `updateUser` porque aquele exige um `UpdateUserDto`
   * completo (nome e e-mail) e reescreve o registro inteiro a partir do que
   * leu - comportamento certo para a tela de edição, exagerado e arriscado
   * para uma redefinição, onde o usuário nem está autenticado.
   */
  async trocaSenha(id: number, password: string, manager: EntityManager): Promise<void> {
    await manager.update(Users, id, { password: await bcrypt.hash(password, 10) });
  }

  async updateUser(id: number, updateUserDto: UpdateUserDto, manager: EntityManager) {
    const user = await this.findById(id);
    if (!user) {
      this.logger.error(`Erro de atualizar usuario: Usuário não localizado com este id`);
      throw new BadRequestException('Usuário não localizado com este id');
    }

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }
    const updateUser = this.create({
      ...user,
      ...updateUserDto,
    });
    return await manager.save(Users, updateUser);
  }

  async deleteUser(id: number, manager: EntityManager) {
    const user = await this.findById(id);
    if (!user) {
      this.logger.error(`Erro de deletar usuario: Usuário não localizado com este id`);
      throw new BadRequestException('Usuário não localizado com este id');
    }

    const updateUser = {
      ...user,
      status: 0,
    };
    return await manager.save(Users, updateUser);
  }
}
