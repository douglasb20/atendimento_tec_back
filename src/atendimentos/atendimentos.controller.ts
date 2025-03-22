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
import { AtendimentosService } from './atendimentos.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateAtendimentoDto } from './dto/create-atendimento.dto';
import { UpdateAtendimentoDto } from './dto/update-atendimento.dto';
import { Permissions } from 'permissions/permissions.decorator';
import { PermissionGuard } from 'permissions/permissions.guard';

@Controller('atendimentos')
export class AtendimentosController {
  constructor(private readonly atendimentoService: AtendimentosService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('atendimento:view')
  @HttpCode(HttpStatus.OK)
  async findAll() {
    return await this.atendimentoService.findAll();
  }

  @Get('/status')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('atendimento:view')
  @HttpCode(HttpStatus.OK)
  async getListStatus() {
    return await this.atendimentoService.getListStatus();
  }

  @Get('/get_by_user/:user_id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('atendimento:view')
  @HttpCode(HttpStatus.OK)
  async findByUserId(@Param('user_id', ParseIntPipe) user_id: number) {
    return await this.atendimentoService.findByUserId(user_id);
  }

  @Get('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('atendimento:view')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.atendimentoService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('atendimento:add')
  @HttpCode(HttpStatus.CREATED)
  async createAtendimento(@Body() createAtendimentoDto: CreateAtendimentoDto) {
    return await this.atendimentoService.createAtendimento(createAtendimentoDto);
  }

  @Patch('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('atendimento:update')
  @HttpCode(HttpStatus.OK)
  async updateAtendimento(
    @Param('id', ParseIntPipe) id: number,
    @Body() createAtendimentoDto: UpdateAtendimentoDto,
  ) {
    return await this.atendimentoService.updateAtendimento(id, createAtendimentoDto);
  }

  @Delete('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('atendimento:delete')
  @HttpCode(HttpStatus.OK)
  async deleteAtendimento(@Param('id', ParseIntPipe) id: number) {
    return await this.atendimentoService.deleteAtendimento(id);
  }
}
