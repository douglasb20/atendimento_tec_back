import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, UseGuards } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { AuthGuard } from '@nestjs/passport';
import { Permissions } from 'permissions/permissions.decorator';
import { PermissionGuard } from 'permissions/permissions.guard';
import { UpdateContactsDto } from './dto/update-contacts.dto';

@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) { }


  @Delete('/contact/:contact_id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('contact:delete')
  @HttpCode(HttpStatus.OK)
  async deleteContact(
    @Param('contact_id', ParseIntPipe) contact_id: number,
  ) {
    return this.contactsService.deleteContact(contact_id);
  }

  @Patch('/contact/:contact_id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('contact:update')
  @HttpCode(HttpStatus.OK)
  async updateContact(
    @Body() updateContactDto: UpdateContactsDto,
    @Param('client_id', ParseIntPipe) client_id: number,
    @Param('contact_id', ParseIntPipe) contact_id: number,
  ) {
    return this.contactsService.updateContact(updateContactDto, contact_id, client_id);
  }

  @Get('/contact')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('contact:view_by_client')
  @HttpCode(HttpStatus.OK)
  async getAllContactsByClients(@Param('client_id', ParseIntPipe) client_id: number) {
    return this.contactsService.getAllContactsByClients(client_id);
  }
}
