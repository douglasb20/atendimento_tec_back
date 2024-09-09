import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ClientService } from './client.service';
import { CreateClientDto } from './dto/create-client.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('clients')
export class ClientController {
  constructor(private readonly clientService: ClientService) {}

  @Post('/create_client')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.CREATED)
  async createClient(@Body() createClienteDto: CreateClientDto) {
    return this.clientService.createClient(createClienteDto);
  }
}
