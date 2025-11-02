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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { PermissionGuard } from 'permissions/permissions.guard';
import { ChannelsService } from './channels.service';
import { CreateOrChannelDto } from './dto/create-or-channel.dto';
import { Permissions } from 'permissions/permissions.decorator';
import { FileInterceptor } from '@nestjs/platform-express';
import { IMAGES_PATH } from 'Constants';
import { move_file } from 'Utils';

@Controller('channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('channel:view')
  @HttpCode(HttpStatus.OK)
  async getActiveChannels() {
    return this.channelsService.getActiveChannels();
  }

  @Get('/:channelId')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('channel:view')
  @HttpCode(HttpStatus.OK)
  async findChannel(@Param('channelId') channelId: number) {
    return this.channelsService.findChannel(channelId);
  }

  @Get('/:channelId/start')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('channel:view')
  @HttpCode(HttpStatus.OK)
  async startSession(@Param('channelId') channelId: number) {
    return this.channelsService.startSession(channelId);
  }

  @Get('/:channelId/terminate')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('channel:view')
  @HttpCode(HttpStatus.OK)
  async closeSession(@Param('channelId') channelId: number) {
    return this.channelsService.closeSession(channelId);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('channel:create')
  @HttpCode(HttpStatus.CREATED)
  async createChannel(@Body() createChannelDto: CreateOrChannelDto) {
    return this.channelsService.createChannel(createChannelDto);
  }

  @Patch('/:channelId')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('channel:update')
  @HttpCode(HttpStatus.OK)
  async updateChannel(
    @Param('channelId') channelId: number,
    @Body() createChannelDto: CreateOrChannelDto,
  ) {
    return this.channelsService.updateChannel(channelId, createChannelDto);
  }

  @Delete('/:channelId')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('channel:delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeChannel(@Param('channelId') channelId: number) {
    return this.channelsService.removeChannel(channelId);
  }

  @Post('/upload')
  @UseInterceptors(FileInterceptor('file1'))
  @HttpCode(HttpStatus.OK)
  async upload(@UploadedFile() file: Express.Multer.File, @Body() body: { name: string }) {
    console.log('file', file);
    console.log('body', body.name);
    await move_file(file.path, IMAGES_PATH + file.filename);
    return {
      file,
      body,
    };
  }
}
