import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AtendimentosService } from './atendimentos.service';
import { AuthGuard } from '@nestjs/passport';
import { CreateAtendimentoDto } from './dto/create-atendimento.dto';

@Controller('atendimentos')
export class AtendimentosController {
  constructor(private readonly atendimentoService: AtendimentosService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async findAll() {
    return await this.atendimentoService.findAll();
  }

  @Get('/:id')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string) {
    return await this.atendimentoService.findOne(Number.parseInt(id));
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createAtendimento(@Body() createAtendimentoDto: CreateAtendimentoDto) {
    return this.atendimentoService.createAtendimento(createAtendimentoDto);
  }
}
