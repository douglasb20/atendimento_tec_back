import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersEntity } from './entities/users.entity';
import { UpdateUserDto } from './dto/update-user.dto';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UserRepository extends Repository<UsersEntity> {
  private readonly logger = new Logger(UserRepository.name);
  constructor(dataSource: DataSource) {
    super(UsersEntity, dataSource.manager);
  }

  async findActives() {
    return this.findBy({ status: 1 });
  }

  async findById(id: number) {
    const user = await this.findOne({ where: { id: id } });
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
    return await manager.save(UsersEntity, newUser);
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
    return await manager.save(UsersEntity, updateUser);
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
    return await manager.save(UsersEntity, updateUser);
  }
}
