import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { Permissions } from 'permissions/permissions.decorator';
import { PermissionGuard } from 'permissions/permissions.guard';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { UpdateDepartmentUsersDto } from './dto/update-department-users.dto';
import { UpdateDepartmentScheduleDto } from './dto/update-department-schedule.dto';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  // `user:update` também lista: o cadastro de usuário escolhe os setores, e
  // quem edita usuário sem gerenciar setores precisa ao menos vê-los. O guard é
  // OU entre as permissões.
  @Permissions('department:view', 'user:update', 'user:add')
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.departmentsService.findAll();
  }

  @Get('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('department:view')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.departmentsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('department:add')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateDepartmentDto) {
    return this.departmentsService.create(dto);
  }

  @Patch('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('department:update')
  @HttpCode(HttpStatus.OK)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDepartmentDto) {
    return this.departmentsService.update(id, dto);
  }

  @Delete('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('department:delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.departmentsService.remove(id);
  }

  @Get('/:id/users')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('department:view')
  @HttpCode(HttpStatus.OK)
  membros(@Param('id', ParseIntPipe) id: number) {
    return this.departmentsService.membros(id);
  }

  @Patch('/:id/users')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('department:update')
  @HttpCode(HttpStatus.OK)
  atualizaMembros(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDepartmentUsersDto) {
    return this.departmentsService.atualizaMembros(id, dto.user_ids);
  }

  @Get('/:id/schedule')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('department:view')
  @HttpCode(HttpStatus.OK)
  getSchedule(@Param('id', ParseIntPipe) id: number) {
    return this.departmentsService.getSchedule(id);
  }

  @Patch('/:id/schedule')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('department:update')
  @HttpCode(HttpStatus.OK)
  updateSchedule(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDepartmentScheduleDto) {
    return this.departmentsService.updateSchedule(id, dto);
  }
}
