import {
  BadRequestException,
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
import { ClientService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('client:add')
  @HttpCode(HttpStatus.CREATED)
  async createClient(@Body() createClientDto: CreateClientDto) {
    return await this.clientService.createClient(createClientDto);
  }

  @Patch(':client_id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('client:update')
  @HttpCode(HttpStatus.OK)
  async updateClient(
    @Param('client_id') client_id: string,
    @Body() updateClientDto: UpdateClientDto,
  ) {
    return await this.clientService.updateClient(Number(client_id), updateClientDto);
  }

  /**
   * Só as etiquetas, sem reenviar o cadastro.
   *
   * É o que o painel do chat usa para classificar o cliente durante o
   * atendimento — lá o nome e o CNPJ não estão em mãos, e mandá-los vazios no
   * PATCH comum apagaria o que está gravado.
   */
  @Patch(':client_id/tags')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('client:update')
  @HttpCode(HttpStatus.OK)
  async atualizarEtiquetas(
    @Param('client_id', ParseIntPipe) client_id: number,
    @Body() { tag_ids }: { tag_ids: number[] },
  ) {
    if (!Array.isArray(tag_ids)) {
      throw new BadRequestException('O campo tag_ids é obrigatório');
    }
    return this.clientService.atualizarEtiquetas(client_id, tag_ids);
  }

  @Delete(':client_id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('client:delete')
  @HttpCode(HttpStatus.OK)
  async removeClient(@Param('client_id') client_id: string) {
    return this.clientService.removeClient(Number(client_id));
  }

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('client:view')
  @HttpCode(HttpStatus.OK)
  async findAll() {
    return await this.clientService.findAll();
  }

  @Get(':client_id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('client:view')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('client_id') client_id: string) {
    return await this.clientService.findOne(Number(client_id));
  }
}
