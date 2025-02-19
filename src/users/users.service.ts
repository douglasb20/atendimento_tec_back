import { BadRequestException, Injectable, Logger, Scope } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRepository } from './users.repository';

@Injectable({ scope: Scope.REQUEST })
export class UsersService {
  private query: QueryRunner;
  private readonly logger = new Logger(UsersService.name);
  constructor(
    private readonly usersRepository: UserRepository,
    private dataSource: DataSource,
  ) {
    this.query = this.dataSource.createQueryRunner();
  }

  async findAll() {
    return await this.usersRepository.findActives();
  }

  async addUser(createUserDto: CreateUserDto) {
    try {
      await this.query.startTransaction();

      const newUser = await this.usersRepository.createUser(createUserDto, this.query.manager);
      delete newUser.password;
      await this.query.commitTransaction();

      return newUser;
    } catch (err) {
      await this.query.rollbackTransaction();
      throw err;
    }
  }

  async updateUser(user_id: number, updateUserDto: UpdateUserDto) {
    try {
      await this.query.startTransaction();

      const updatedUser = await this.usersRepository.updateUser(user_id, updateUserDto, this.query.manager);
      delete updatedUser.password;
      await this.query.commitTransaction();

      return updatedUser;
    } catch (err) {
      await this.query.rollbackTransaction();
      throw err;
    }
  }

  async deleteUser(user_id: number) {
    try {
      await this.query.startTransaction();

      const updatedUser = await this.usersRepository.deleteUser(user_id, this.query.manager);
      delete updatedUser.password;
      await this.query.commitTransaction();
      
      return updatedUser;
    } catch (err) {
      await this.query.rollbackTransaction();
      throw err;
    }
  }
}
