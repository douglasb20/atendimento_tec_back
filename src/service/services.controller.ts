import { Body, Controller, Delete, Get, Param, Patch, Post, Sse, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ServicesService } from './services.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { interval, map, Observable } from 'rxjs';

@Controller('servicos')
export class ServicesController {
  constructor(private servicesService: ServicesService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  async findAll() {
    return await this.servicesService.findAll();
  }

  @Sse('sse')
  @UseGuards(AuthGuard('jwt'))
  sse(): Observable<MessageEvent> {
    return interval(1000).pipe(
      map((_) => ({ data: { hello: 'world' } }) as MessageEvent),
    );
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  async findById(@Param('id') id: string) {
    return await this.servicesService.findById(Number(id));
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createService(@Body() createServiceDto: CreateServiceDto) {
    return await this.servicesService.createService(createServiceDto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  async updateService(@Param('id') id: string, @Body() updateServiceDto: UpdateServiceDto) {
    return await this.servicesService.updateService(Number(id), updateServiceDto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async deleteService(@Param('id') id: string) {
    return await this.servicesService.deleteService(Number(id));
  }

}
