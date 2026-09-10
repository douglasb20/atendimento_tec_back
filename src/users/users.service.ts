import { Injectable, Logger, Scope } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { randomUUID } from 'node:crypto';

import { PermissionsRepository } from 'permissions/permissions.repository';
import { PresignedUpload, StorageService } from 'storage/storage.service';
import { CreateUserDto } from './dto/create-user.dto';
import { SignAvatarDto } from './dto/sign-avatar.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Users } from './entities/users.entity';
import { UserRepository } from './users.repository';
import { RedisCacheRepository } from '@/redis-cache/redis-cache.repository';

@Injectable({ scope: Scope.REQUEST })
export class UsersService {
  private query: QueryRunner;
  private readonly logger = new Logger(UsersService.name);
  constructor(
    private readonly redisCacheRepository: RedisCacheRepository,
    private readonly usersRepository: UserRepository,
    private readonly permissionsRepository: PermissionsRepository,
    private readonly storageService: StorageService,
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
      const user = await this.usersRepository.findById(user_id);

      if (!updateUserDto.avatar_url ) {
        const avatar_url = user.avatar_url;
        await this.storageService.deleteObject(avatar_url!);
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
      const avatar_url = updatedUser.avatar_url;
      await this.storageService.deleteObject(avatar_url!);
      await this.redisCacheRepository.del(`presigned:user:${updatedUser.id}:avatar`);

      delete updatedUser.password;
      await this.query.commitTransaction();

      return updatedUser;
    } catch (err) {
      await this.query.rollbackTransaction();
      throw err;
    }
  }

  async userInfo(user_id: number) {
    const user = await this.usersRepository.findById(user_id);
    const permissions = await this.permissionsRepository.permissionByUser(user_id);
    const userWithAvatar = await this.getUserWithURLAvatar(user);

    return { ...userWithAvatar, permissions };
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
