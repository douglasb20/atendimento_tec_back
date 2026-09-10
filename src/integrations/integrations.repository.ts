import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, IsNull, Repository } from 'typeorm';
import { Integrations } from './entities/integrations.entity';

@Injectable()
export class IntegrationsRepository extends Repository<Integrations> {
  constructor(protected dataSource: DataSource) {
    super(Integrations, dataSource.manager);
  }

  async findAllActive(): Promise<Integrations[]> {
    return this.find({
      where: { deleted_at: IsNull() },
      relations: ['integrationProvider'],
      order: { name: 'ASC' },
    });
  }

  async findById(id: number, emitError = true): Promise<Integrations> {
    const integration = await this.findOne({
      where: { id, deleted_at: IsNull() },
      relations: ['integrationProvider'],
    });

    if (!integration && emitError) {
      throw new NotFoundException('Integração não encontrada');
    }

    return integration;
  }

  /**
   * Busca a integração incluindo os campos sensíveis (`select: false` na entidade).
   * Uso restrito à camada de provider — nunca em respostas de API.
   */
  async findByIdWithCredentials(id: number, emitError = true): Promise<Integrations> {
    const integration = await this.createQueryBuilder('i')
      .leftJoinAndSelect('i.integrationProvider', 'provider')
      .addSelect(['i.credentials', 'i.webhook_secret'])
      .where('i.id = :id', { id })
      .andWhere('i.deleted_at IS NULL')
      .getOne();

    if (!integration && emitError) {
      throw new NotFoundException('Integração não encontrada');
    }

    return integration;
  }

  async findDefaultWithCredentials(emitError = true): Promise<Integrations> {
    const integration = await this.createQueryBuilder('i')
      .leftJoinAndSelect('i.integrationProvider', 'provider')
      .addSelect(['i.credentials', 'i.webhook_secret'])
      .where('i.is_default = true')
      .andWhere('i.is_active = true')
      .andWhere('i.deleted_at IS NULL')
      .getOne();

    if (!integration && emitError) {
      throw new NotFoundException(
        'Nenhuma integração padrão configurada. Cadastre uma integração antes de conectar canais.',
      );
    }

    return integration;
  }

  async softDelete_(id: number): Promise<void> {
    await this.update(id, { deleted_at: new Date(), is_default: false, is_active: false });
  }
}
