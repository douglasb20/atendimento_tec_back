import { DataSource, EntityManager, Repository } from 'typeorm';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ServicesEntity } from './entities/service.entity';

@Injectable()
export class ServiceRepository extends Repository<ServicesEntity> {
  private readonly logger = new Logger(ServiceRepository.name);
  constructor(dataSource: DataSource) {
    super(ServicesEntity, dataSource.manager);
  }

  async findActives() {
    return this.find({ where: { status: 1 }, cache: true });
  }

  async findById(id: number) {
    const service = await this.findOne({ where: { id: id }, cache: true });
    if (!service) {
      this.logger.error(`Erro de atualizar serviço: Serviço não localizado com este id`);
      throw new BadRequestException('Serviço não localizado com este id');
    }
    return service;
  }

  async saveService(service: ServicesEntity, manager: EntityManager) {
    return await manager.save(ServicesEntity, service);
  }
}
