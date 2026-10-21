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
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

import { Permissions } from '@/permissions/permissions.decorator';
import { PermissionGuard } from '@/permissions/permissions.guard';
import { Users } from '@/users/entities/users.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { ListSchedulesDto } from './dto/list-schedules.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { SchedulesService } from './schedules.service';

@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('schedule:view')
  async listar(@Query() dto: ListSchedulesDto, @Req() req: Request) {
    return this.schedulesService.listar(dto.inicio_em, dto.fim_em, req.user as Users);
  }

  @Get('atendentes')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('schedule:view')
  async listarAtendentes(@Req() req: Request) {
    return this.schedulesService.listarAtendentes(req.user as Users);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('schedule:view')
  async buscar(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.schedulesService.buscarPorId(id, req.user as Users);
  }

  @Post('conflitos')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('schedule:add')
  async conflitos(@Body() dto: CreateScheduleDto, @Req() req: Request) {
    return this.schedulesService.listarConflitos(dto, req.user as Users);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('schedule:add')
  @HttpCode(HttpStatus.CREATED)
  async criar(@Body() dto: CreateScheduleDto, @Req() req: Request) {
    return this.schedulesService.criar(dto, req.user as Users);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('schedule:edit')
  async atualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateScheduleDto,
    @Req() req: Request,
  ) {
    return this.schedulesService.atualizar(id, dto, req.user as Users);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('schedule:delete')
  @HttpCode(HttpStatus.OK)
  async remover(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    return this.schedulesService.remover(id, req.user as Users);
  }
}
