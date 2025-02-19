import { DataSource, EntityManager, Repository } from 'typeorm';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Services } from './entities/service.entity';

@Injectable()
export class ServiceRepository extends Repository<Services> {
  private readonly logger = new Logger(ServiceRepository.name);
  constructor(dataSource: DataSource) {
    super(Services, dataSource.manager);
  }

  async findActives() {
    return this.findBy({ status: 1 });
  }

  async findById(id: number) {
    const service = await this.findOne({ where: { id: id } });
    if (!service) {
      this.logger.error(`Erro de atualizar serviço: Serviço não localizado com este id`);
      throw new BadRequestException('Serviço não localizado com este id');
    }
    return service;
  }

  async saveService(service: Services, manager: EntityManager) {
    return await manager.save(Services, service);
  }
}
