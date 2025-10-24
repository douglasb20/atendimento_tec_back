import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionGuard } from './permissions.guard';
import { Permissions } from './permissions.decorator';
import { PermissionService } from './permission.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Controller('permissions')
export class PermissionsController {
  constructor(private permissionService: PermissionService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('permission:view')
  async findAll() {
    return this.permissionService.findAll();
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @HttpCode(HttpStatus.CREATED)
  async createPermission(@Body() createPermissionDto: CreatePermissionDto[]) {
    if (createPermissionDto.length === 0) {
      throw new BadRequestException('Nenhuma permissão informada');
    }
    return await this.permissionService.createPermission(createPermissionDto);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @HttpCode(HttpStatus.OK)
  async updatePermission(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    return await this.permissionService.updatePermission(id, updatePermissionDto);
  }

  // =============== Modules =============

  @Get('/modules')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('permission:view')
  async findAllModules() {
    return this.permissionService.findAllModules();
  }
}
