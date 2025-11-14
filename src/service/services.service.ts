import { runInTransaction } from '@/Utils';
import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { ServiceRepository } from './services.repository';

@Injectable()
export class ServicesService {
  private readonly logger = new Logger(ServicesService.name);
  constructor(
    private readonly serviceRepository: ServiceRepository,
    private dataSource: DataSource,
  ) {}

  async findAll() {
    return await this.serviceRepository.findActives();
  }

  async findById(id: number) {
    return await this.serviceRepository.findById(id);
  }

  async createService(createServiceDto: CreateServiceDto) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const service = this.serviceRepository.create(createServiceDto);
        await this.serviceRepository.saveService(service, manager);

        return service;
      } catch (err) {
        this.logger.error(err.message);
        throw err;
      }
    });
  }

  async updateService(id: number, updateServiceDto: UpdateServiceDto) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const service = await this.serviceRepository.findById(id);

        const updateService = {
          ...service,
          ...updateServiceDto,
        };

        await this.serviceRepository.saveService(updateService, manager);
        return updateService;
      } catch (err) {
        throw err;
      }
    });
  }

  async deleteService(id: number) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const service = await this.serviceRepository.findById(id);

        const deleteService = this.serviceRepository.create({
          ...service,
          status: 0,
        });

        await this.serviceRepository.saveService(deleteService, manager);

        return deleteService;
      } catch (err) {
        throw err;
      }
    });
  }
}
