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
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from 'permissions/permissions.decorator';
import { PermissionGuard } from 'permissions/permissions.guard';

import { CustomFieldsService } from './custom-fields.service';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';
import { AplicaA } from './entities/custom-fields.entity';

@Controller('custom-fields')
export class CustomFieldsController {
  constructor(private readonly customFieldsService: CustomFieldsService) {}

  /**
   * O catálogo, opcionalmente filtrado pelo lado que vai usá-lo.
   *
   * `aplica_a=contato` traz os de contato **e** os de `ambos` - é o que o
   * formulário pede para montar o seletor.
   */
  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('custom.field:view', 'contact:update', 'client:update')
  @HttpCode(HttpStatus.OK)
  async findAll(@Query('aplica_a') aplicaA?: Exclude<AplicaA, 'ambos'>) {
    return this.customFieldsService.findAll(
      aplicaA === 'contato' || aplicaA === 'cliente' ? aplicaA : undefined,
    );
  }

  @Get('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('custom.field:view')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.customFieldsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('custom.field:add')
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateCustomFieldDto) {
    return this.customFieldsService.create(dto);
  }

  @Patch('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('custom.field:update')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomFieldDto) {
    return this.customFieldsService.update(id, dto);
  }

  @Delete('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('custom.field:delete')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.customFieldsService.remove(id);
  }
}
