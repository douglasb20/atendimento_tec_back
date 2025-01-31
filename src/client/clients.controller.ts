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
import { ClientService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { AuthGuard } from '@nestjs/passport';
import { UpdateContactsDto } from './dto/update-contacts.dto';
import { UpdateClientDto } from './dto/update-client.dto';

@Controller('clients')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.CREATED)
  async createClient(@Body() createClientDto: CreateClientDto) {
    return await this.clientService.createClient(createClientDto);
  }

  @Patch(':client_id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async updateClient(
    @Param('client_id') client_id: string,
    @Body() updateClientDto: UpdateClientDto,
  ) {
    return await this.clientService.updateClient(Number(client_id), updateClientDto);
  }

  @Delete(':client_id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async removeClient(@Param('client_id') client_id: string) {
    return this.clientService.removeClient(Number(client_id));
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async findAll() {
    return await this.clientService.findAll();
  }

  @Get(':client_id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('client_id') client_id: string) {
    return await this.clientService.findOne(Number(client_id));
  }

  @Delete(':client_id/contact/:contact_id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async deleteContact(
    @Param('client_id') client_id: string,
    @Param('contact_id') contact_id: string,
  ) {
    return this.clientService.deleteContact(client_id, contact_id);
  }

  @Patch(':client_id/contact/:contact_id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async updateContact(
    @Body() updateContactDto: UpdateContactsDto,
    @Param('client_id') client_id: string,
    @Param('contact_id') contact_id: string,
  ) {
    return this.clientService.updateContact(updateContactDto, client_id, contact_id);
  }

  @Get(':client_id/contact')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async getAllContactsByClients(@Param('client_id') client_id: string) {
    return this.clientService.getAllContactsByClients(client_id);
  }
}
