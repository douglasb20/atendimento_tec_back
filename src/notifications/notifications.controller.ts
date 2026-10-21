import { Controller, Get, Param, ParseIntPipe, Patch, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { PermissionGuard } from '@/permissions/permissions.guard';
import { SemPermissao } from '@/permissions/sem-permissao.decorator';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'), PermissionGuard)
@SemPermissao()
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}
  @Get() listar(@Req() req: Request) { return this.service.listar(req.user['id']); }
  @Patch('read-all') lerTodas(@Req() req: Request) { return this.service.marcarTodasComoLidas(req.user['id']); }
  @Patch(':id/read') lerUma(@Param('id', ParseIntPipe) id: number, @Req() req: Request) { return this.service.marcarComoLida(id, req.user['id']); }
}
