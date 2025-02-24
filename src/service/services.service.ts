import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceRepository } from './services.repository';

@Injectable()
export class ServicesService {
  private query: QueryRunner;
  private readonly logger = new Logger(ServicesService.name);
  constructor(
    private readonly serviceRepository: ServiceRepository,
    private dataSource: DataSource,
  ) {
    this.query = this.dataSource.createQueryRunner();
  }

  async findAll() {
    return await this.serviceRepository.findActives();
  }

  async findById(id: number) {
    return await this.serviceRepository.findById(id);
  }

  async createService(createServiceDto: CreateServiceDto) {
    try {
      this.query.startTransaction();
      const service = this.serviceRepository.create(createServiceDto);
      await this.serviceRepository.saveService(service, this.query.manager);

      this.query.commitTransaction();
      return service;
    } catch (err) {
      this.query.rollbackTransaction();
      throw err;
    }
  }

  async updateService(id: number, updateServiceDto: UpdateServiceDto) {
    try {
      this.query.startTransaction();
      const service = await this.serviceRepository.findById(id);

      const updateService = {
        ...service,
        ...updateServiceDto,
      };

      await this.serviceRepository.saveService(updateService, this.query.manager);

      this.query.commitTransaction();
      return updateService;
    } catch (err) {
      this.query.rollbackTransaction();
      throw err;
    }
  }

  async deleteService(id: number) {
    try {
      this.query.startTransaction();
      const service = await this.serviceRepository.findById(id);

      const deleteService = this.serviceRepository.create({
        ...service,
        status: 0,
      });

      await this.serviceRepository.saveService(deleteService, this.query.manager);

      this.query.commitTransaction();
      return deleteService;
    } catch (err) {
      this.query.rollbackTransaction();
      throw err;
    }
  }
}
