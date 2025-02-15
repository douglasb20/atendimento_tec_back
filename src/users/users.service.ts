import { BadRequestException, Inject, Injectable, Scope } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Users } from './entities/users.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable({ scope: Scope.REQUEST })
export class UsersService {
  private query: QueryRunner;
  constructor(
    @InjectRepository(Users)
    private readonly usersRepository: Repository<Users>,
    private dataSource: DataSource,
  ) {
    this.query = dataSource.createQueryRunner();
  }

  async findAll() {
    return await this.usersRepository.findBy({
      status: 1,
    });
  }

  async addUser(createUserDto: CreateUserDto) {
    try {
      await this.query.startTransaction();
      const newUser = this.usersRepository.create({
        ...createUserDto,
        password: await bcrypt.hash(createUserDto.password, 10),
      });

      await this.query.manager.save(Users, newUser);
      await this.query.commitTransaction();
      delete newUser.password;
      return newUser;
    } catch (err) {
      await this.query.rollbackTransaction();
      throw err;
    }
  }

  async updateUser(user_id: number, updateUserDto: UpdateUserDto) {
    try {
      await this.query.startTransaction();
      const user = await this.usersRepository.findOneBy({ id: user_id });
      if (!user) {
        throw new BadRequestException('Usuário não localizado com este id');
      }

      if (updateUserDto.password) {
        updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
      }
      const updateUser = this.usersRepository.create({
        ...user,
        ...updateUserDto,
      });

      await this.query.manager.save(Users, updateUser);
      await this.query.commitTransaction();
      delete updateUser.password;
      return updateUser;
    } catch (err) {
      await this.query.rollbackTransaction();
      throw err;
    }
  }

  async deleteUser(user_id: number) {
    try {
      await this.query.startTransaction();
      const user = await this.usersRepository.findOneBy({ id: user_id });
      if (!user) {
        throw new BadRequestException('Usuário não localizado com este id');
      }

      const updateUser = this.usersRepository.create({
        ...user,
        status: 0,
      });

      await this.query.manager.save(Users, updateUser);
      await this.query.commitTransaction();
      delete updateUser.password;
    } catch (err) {
      await this.query.rollbackTransaction();
      throw err;
    }
  }
}
