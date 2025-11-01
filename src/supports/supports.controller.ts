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
  Query,
  UseGuards,
} from '@nestjs/common';
import { SupportsService } from './supports.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateSupportDto } from './dto/create-support.dto';
import { UpdateSupportDto } from './dto/update-support.dto';
import { Permissions } from 'permissions/permissions.decorator';
import { PermissionGuard } from 'permissions/permissions.guard';

@Controller('supports')
export class SupportsController {
  constructor(private readonly supportsService: SupportsService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('supports:view')
  @HttpCode(HttpStatus.OK)
  async findAll() {
    return await this.supportsService.findAll();
  }

  @Get('/status')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('supports:view')
  @HttpCode(HttpStatus.OK)
  async getListStatus() {
    return await this.supportsService.getListStatus();
  }

  @Get('/:userId/filter')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('supports:view')
  @HttpCode(HttpStatus.OK)
  async filterByDate(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('dataInicio') dataInicio: string,
    @Query('dataFim') dataFim: string,
  ) {
    return await this.supportsService.filterByDate(userId, dataInicio, dataFim);
  }

  @Get('/get_by_user/:user_id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('supports:view')
  @HttpCode(HttpStatus.OK)
  async findByUserId(@Param('user_id', ParseIntPipe) user_id: number) {
    return await this.supportsService.findByUserId(user_id);
  }

  @Get('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('supports:view')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return await this.supportsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('supports:add')
  @HttpCode(HttpStatus.CREATED)
  async createSupport(@Body() createSupportDto: CreateSupportDto) {
    return await this.supportsService.createSupport(createSupportDto);
  }

  @Patch('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('supports:update')
  @HttpCode(HttpStatus.OK)
  async updateSupport(
    @Param('id', ParseIntPipe) id: number,
    @Body() createSupportDto: UpdateSupportDto,
  ) {
    return await this.supportsService.updateSupport(id, createSupportDto);
  }

  @Delete('/:id')
  @UseGuards(AuthGuard('jwt'), PermissionGuard)
  @Permissions('supports:delete')
  @HttpCode(HttpStatus.OK)
  async deleteSupport(@Param('id', ParseIntPipe) id: number) {
    return await this.supportsService.deleteSupport(id);
  }
}
