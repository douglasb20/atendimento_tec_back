import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
