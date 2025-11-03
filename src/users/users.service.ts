import { PresignedPost } from '@aws-sdk/s3-presigned-post';
import { Injectable, Logger, Scope } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { v4 as uuidV4 } from 'uuid';

import { PermissionsRepository } from 'permissions/permissions.repository';
import { StorageService } from 'storage/storage.service';
import { CreateUserDto } from './dto/create-user.dto';
import { SignAvatarDto } from './dto/sign-avatar.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Users } from './entities/users.entity';
import { UserRepository } from './users.repository';

@Injectable({ scope: Scope.REQUEST })
export class UsersService {
  private query: QueryRunner;
  private readonly logger = new Logger(UsersService.name);
  constructor(
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
    if (user.avatar_url) {
      user.avatar_url = await this.storageService.generateViewUrl(user.avatar_url);
    }
    return user;
  }

  async signAvatar(signAvatarDto: SignAvatarDto): Promise<PresignedPost> {
    try {
      if(signAvatarDto?.user_id){
        await this.usersRepository.findById(signAvatarDto.user_id);
      }

      const avatarName = `${signAvatarDto.key}/${uuidV4()}.${signAvatarDto.fileType.split('/')[1]}`;

      const avatar_url = await this.storageService.createPresignedPost(avatarName);

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

      if (!updateUserDto.avatar_url) {
        const user = await this.usersRepository.findById(user_id);
        const avatar_url = user.avatar_url;
        await this.storageService.deleteObject(avatar_url!);
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
