import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from 'permissions/permissions.decorator';
import { PermissionGuard } from 'permissions/permissions.guard';
import { CreateContactsDto } from './dto/create-contacts.dto';
import { UpdateContactsDto } from './dto/update-contacts.dto';
import { SignContactAvatarDto } from './dto/sign-contact-avatar.dto';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('contact:view')
  @HttpCode(HttpStatus.OK)
  async getAllContacts() {
    return this.contactsService.getAllContacts();
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('contact:add')
  @HttpCode(HttpStatus.CREATED)
  async createContact(@Body() createContactDto: CreateContactsDto) {
    return this.contactsService.createContact(createContactDto);
  }

  @Delete('/contact/:contact_id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('contact:delete')
  @HttpCode(HttpStatus.OK)
  async deleteContact(@Param('contact_id', ParseIntPipe) contact_id: number) {
    return this.contactsService.deleteContact(contact_id);
  }

  @Patch('/contact/:contact_id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('contact:update')
  @HttpCode(HttpStatus.OK)
  async updateContact(
    @Body() updateContactDto: UpdateContactsDto,
    @Param('contact_id', ParseIntPipe) contact_id: number,
  ) {
    // O `client_id` vem do corpo: a rota não tem esse parâmetro, e declará-lo
    // como @Param fazia o ParseIntPipe receber undefined e responder 400 em
    // toda chamada. `?? null` porque o repositório distingue ausência de valor.
    return this.contactsService.updateContact(
      updateContactDto,
      contact_id,
      updateContactDto.client_id ?? null,
    );
  }

  @Get('/contact')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('contact:view_by_client')
  @HttpCode(HttpStatus.OK)
  async getAllContactsByClients(@Query('client_id', ParseIntPipe) client_id: number) {
    return this.contactsService.getAllContactsByClients(client_id);
  }

  @Post('/contact/:contact_id/sign-avatar')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('contact:update')
  @HttpCode(HttpStatus.OK)
  async signAvatar(
    @Param('contact_id', ParseIntPipe) contact_id: number,
    @Body() dto: SignContactAvatarDto,
  ) {
    return this.contactsService.signAvatar(contact_id, dto);
  }

  /**
   * O "sim" da confirmação de "quer buscar a foto do contato?", exibida ao
   * remover o avatar manual - busca na Evolution na hora, não espera a
   * próxima mensagem do contato.
   */
  @Post('/contact/:contact_id/buscar-foto-whatsapp')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('contact:update')
  @HttpCode(HttpStatus.OK)
  async buscarFotoDoWhatsapp(@Param('contact_id', ParseIntPipe) contact_id: number) {
    return this.contactsService.buscarFotoDoWhatsapp(contact_id);
  }
}
