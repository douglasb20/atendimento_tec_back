import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { Permissions } from 'permissions/permissions.decorator';
import { PermissionGuard } from 'permissions/permissions.guard';
import { ChatbotsService } from './chatbots.service';
import { AssinarMediaDto } from './dto/assinar-media.dto';
import { CreateChatbotDto } from './dto/create-chatbot.dto';
import { SaveFlowDto } from './dto/save-flow.dto';
import { UpdateChatbotDto } from './dto/update-chatbot.dto';

@Controller('chatbots')
export class ChatbotsController {
  constructor(private readonly chatbotsService: ChatbotsService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('chatbot:view')
  @HttpCode(HttpStatus.OK)
  findAll(@Query('type') type?: string) {
    if (type === 'complementar') {
      return this.chatbotsService.findAllComplementares();
    }

    return this.chatbotsService.findAll();
  }

  @Get('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('chatbot:view')
  @HttpCode(HttpStatus.OK)
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.chatbotsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('chatbot:add')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateChatbotDto) {
    return this.chatbotsService.create(dto);
  }

  @Patch('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('chatbot:update')
  @HttpCode(HttpStatus.OK)
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateChatbotDto) {
    return this.chatbotsService.update(id, dto);
  }

  @Delete('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('chatbot:delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.chatbotsService.remove(id);
  }

  @Get('/:id/flow')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('chatbot:view')
  @HttpCode(HttpStatus.OK)
  findDraft(@Param('id', ParseIntPipe) id: number) {
    return this.chatbotsService.findDraft(id);
  }

  @Put('/:id/flow')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('chatbot:update')
  @HttpCode(HttpStatus.OK)
  saveFlow(@Param('id', ParseIntPipe) id: number, @Body() dto: SaveFlowDto) {
    return this.chatbotsService.saveFlow(id, dto);
  }

  @Post('/sign-media')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('chatbot:update')
  @HttpCode(HttpStatus.OK)
  assinarMedia(@Body() dto: AssinarMediaDto) {
    return this.chatbotsService.assinarMedia(dto);
  }
}
