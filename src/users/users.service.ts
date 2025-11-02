import { Injectable, Logger, Scope } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRepository } from './users.repository';
import { Users } from './entities/users.entity';
import { PermissionsRepository } from 'permissions/permissions.repository';

@Injectable({ scope: Scope.REQUEST })
export class UsersService {
  private query: QueryRunner;
  private readonly logger = new Logger(UsersService.name);
  constructor(
    private readonly usersRepository: UserRepository,
    private readonly permissionsRepository: PermissionsRepository,
    private dataSource: DataSource,
  ) {
    this.query = this.dataSource.createQueryRunner();
  }

  async findAll(): Promise<Users[]> {
    const users = await this.usersRepository.findActives();
    return users;
  }

  async addUser(createUserDto: CreateUserDto): Promise<Users> {
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

  async updateUser(user_id: number, updateUserDto: UpdateUserDto): Promise<Users> {
    try {
      await this.query.startTransaction();

      const updatedUser = await this.usersRepository.updateUser(
        user_id,
        updateUserDto,
        this.query.manager,
      );
      delete updatedUser.password;
      await this.query.commitTransaction();

      return updatedUser;
    } catch (err) {
      await this.query.rollbackTransaction();
      throw err;
    }
  }

  async deleteUser(user_id: number): Promise<Users> {
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

  async permissionsByUser(user_id: number) {
    return this.permissionsRepository.permissionByUser(user_id);
  }
}
