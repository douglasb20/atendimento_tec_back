import { Injectable } from '@nestjs/common';
import {  } from './entities/permission-x-user.entity';
import { PermissionsRepository } from './permissions.repository';

@Injectable()
export class PermissionService {
  constructor(
    private readonly permissionXUserRepo: PermissionsRepository,
  ) {}

  async hasPermission(userId: number, permission: string): Promise<boolean> {
    const permissionRecord = await this.permissionXUserRepo.hasPermission(userId, permission);

    return permissionRecord;
  }
}
