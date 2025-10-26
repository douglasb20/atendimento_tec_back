import { Controller, Get, HttpCode, HttpStatus, Param, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { PermissionGuard } from 'permissions/permissions.guard';
import { ChannelsService } from './channels.service';

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @HttpCode(HttpStatus.OK)
  async getActiveChannels() {
    return this.channelsService.getActiveChannels();
  }

  @Get("/start/:channelId")
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @HttpCode(HttpStatus.OK)
  async startSession(@Param('channelId') channelId: number) {
    return this.channelsService.startSession(channelId);
  }
}
