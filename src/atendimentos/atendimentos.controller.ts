import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
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

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createAtendimento(@Body() createAtendimentoDto: CreateAtendimentoDto) {
    return this.atendimentoService.createAtendimento(createAtendimentoDto);
  }
}
