import { Injectable } from '@nestjs/common';
import { PermissionsRepository } from './permissions.repository';

@Injectable()
export class PermissionService {
  constructor(private readonly permissionRepository: PermissionsRepository) {}

  async hasPermission(userId: number, permission: string): Promise<boolean> {
    const permissionRecord = await this.permissionRepository.hasPermission(userId, permission);

    return permissionRecord;
  }

  async findAll() {
    return this.permissionRepository.findAllPermissions();
  }

  async permissionByUser(user_id: number) {
    return this.permissionRepository.permissionByUser(user_id);
  }

  async createPermission() {
    try {
      
    } catch (err) {
      
    }
  }

  async updatePermission() {
    try {
      
    } catch (err) {
      
    }
  }
  

  async deletePermission() {
    
  }
  
  // =============== Modules =============

  async findAllModules() {
    return this.permissionRepository.findAllModules();
  }

  async createModule() {
    
  }

  async updateModule() {
    
  }
  
}
