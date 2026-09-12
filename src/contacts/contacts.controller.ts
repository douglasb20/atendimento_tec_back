import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from 'permissions/permissions.decorator';
import { PermissionGuard } from 'permissions/permissions.guard';
import { UpdateContactsDto } from './dto/update-contacts.dto';

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
}
