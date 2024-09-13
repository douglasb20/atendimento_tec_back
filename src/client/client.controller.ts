import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ClientService } from './client.service';
import { CreateClientDto } from './dto/create-client.dto';
import { AuthGuard } from '@nestjs/passport';
import { UpdateContactsDto } from './dto/update-contacts.dto';

@Controller('clients')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post('/create_client')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.CREATED)
  async createClient(@Body() createClientDto: CreateClientDto) {
    return await this.clientService.createClient(createClientDto);
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
  async deleteContact(@Param('client_id') client_id: string, @Param('contact_id') contact_id: string) {
    return this.clientService.deleteContact(client_id, contact_id);
  }

  @Patch(':client_id/contact/:contact_id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async updateContact(
    @Body() updateContactDto: UpdateContactsDto,
    @Param('client_id') client_id: string,
    @Param('contact_id') contact_id: string
  ) {
    return this.clientService.updateContact(updateContactDto, client_id, contact_id);
  }
}

