import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import { Services } from './entities/service.entity';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  private query: QueryRunner;
  constructor(
    @InjectRepository(Services)
    private serviceRepository: Repository<Services>,
    private dataSource: DataSource,
  ) {
    this.query = this.dataSource.createQueryRunner();
  }

  async findAll() {
    return await this.serviceRepository.findBy({ status: 1 });
  }

  async findById(id: number) {
    return await this.serviceRepository.findOneBy({ id });
  }

  async createService(createServiceDto: CreateServiceDto) {
    try {
      this.query.startTransaction();
      const service = this.serviceRepository.create(createServiceDto);
      await this.query.manager.save(Services, service);

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
      const service = await this.serviceRepository.findOneBy({ id });
      if (!service) {
        throw new BadRequestException('Serviço não localizado com este id');
      }

      const updateService = this.serviceRepository.create(
        {
          ...service,
          ...updateServiceDto
        }
      );

      await this.query.manager.save(Services, updateService);

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
      const service = await this.serviceRepository.findOneBy({ id });
      if (!service) {
        throw new BadRequestException('Serviço não localizado com este id');
      }

      const deleteService = this.serviceRepository.create(
        {
          ...service,
          status: 0
        }
      );

      await this.query.manager.save(Services, deleteService);

      this.query.commitTransaction();
      return deleteService;
    } catch (err) {
      this.query.rollbackTransaction();
      throw err;
    }
  }

}
