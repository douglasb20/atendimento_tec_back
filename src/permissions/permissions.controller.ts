import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from './permissions.guard';
import { Permissions } from './permissions.decorator';
import { PermissionService } from './permission.service';

@Controller('permissions')
export class PermissionsController {
  constructor(
    private permissionService: PermissionService
  ) { }
  
  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('permission:view')
  async findAll() {
    return this.permissionService.findAll()
  }
  
  // =============== Modules =============
  
  @Get('/modules')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('permission:view')
  async findAllModules() {
    return this.permissionService.findAllModules()
  }
}
