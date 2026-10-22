import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { Permissions } from 'permissions/permissions.decorator';
import { PermissionGuard } from 'permissions/permissions.guard';
import { HolidaysService } from './holidays.service';
import { CreateHolidayDto } from './dto/create-holiday.dto';
import { UpdateHolidayDto } from './dto/update-holiday.dto';

@Controller('holidays')
export class HolidaysController {
  constructor(private readonly holidaysService: HolidaysService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  // O nó Feriados do chatbot vai consultar isso em runtime - quando o motor
  // ganhar esse nó, adicionar aqui a permissão que ele usa (ou liberar via
  // chamada interna do service, sem passar pelo controller).
  @Permissions('holiday:view')
  @HttpCode(HttpStatus.OK)
  findAll() {
    return this.holidaysService.findAll();
  }

  @Get('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('holiday:view')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.holidaysService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('holiday:add')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateHolidayDto) {
    return this.holidaysService.create(dto);
  }

  @Patch('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('holiday:update')
  @HttpCode(HttpStatus.OK)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateHolidayDto) {
    return this.holidaysService.update(id, dto);
  }

  @Delete('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('holiday:delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.holidaysService.remove(id);
  }
}
