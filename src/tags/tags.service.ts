import { runInTransaction } from '@/Utils';
import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { Tags } from './entities/tags.entity';
import { TagsRepository } from './tags.repository';

@Injectable()
export class TagsService {
  private readonly logger = new Logger(TagsService.name);

  constructor(
    private readonly tagsRepository: TagsRepository,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<Tags[]> {
    return this.tagsRepository.findAllActive();
  }

  async findOne(id: number): Promise<Tags> {
    return this.tagsRepository.findById(id);
  }

  async create(createTagDto: CreateTagDto): Promise<Tags> {
    const name = createTagDto.name.trim();

    if (await this.tagsRepository.nomeEmUso(name)) {
      throw new ConflictException(`Já existe uma etiqueta chamada "${name}"`);
    }

    return runInTransaction(this.dataSource, async (manager) => {
      const tag = this.tagsRepository.create({ ...createTagDto, name });
      const salva = await manager.save(Tags, tag);

      this.logger.log(`Etiqueta criada: ${salva.name} (id ${salva.id})`);

      return salva;
    });
  }

  async update(id: number, updateTagDto: UpdateTagDto): Promise<Tags> {
    const tag = await this.tagsRepository.findById(id);
    const name = updateTagDto.name?.trim();

    if (name && (await this.tagsRepository.nomeEmUso(name, id))) {
      throw new ConflictException(`Já existe uma etiqueta chamada "${name}"`);
    }

    return runInTransaction(this.dataSource, async (manager) => {
      // Merge parcial: campo ausente no DTO fica como está.
      await manager.save(Tags, {
        ...tag,
        ...(name && { name }),
        ...(updateTagDto.color && { color: updateTagDto.color }),
        ...(updateTagDto.text_color && { text_color: updateTagDto.text_color }),
      });

      this.logger.log(`Etiqueta atualizada: id ${id}`);

      // A releitura usa o manager da transação: o repository comum abriria
      // outra conexão e não enxergaria a alteração ainda não commitada.
      return manager.findOne(Tags, { where: { id } });
    });
  }

  async remove(id: number): Promise<{ status: string }> {
    const tag = await this.tagsRepository.findById(id);

    // Remover uma etiqueta em uso apagaria a classificação de vários clientes
    // de uma vez, em silêncio. A contagem na mensagem diz o tamanho do estrago
    // que seria — e o atendente decide se vale desvincular antes.
    const vinculados = await this.tagsRepository.contarClientesVinculados(id);

    if (vinculados > 0) {
      throw new BadRequestException(
        `Não é possível remover: ${vinculados} ${
          vinculados === 1 ? 'cliente usa' : 'clientes usam'
        } esta etiqueta.`,
      );
    }

    await this.tagsRepository.update(id, { deleted_at: new Date() });

    this.logger.log(`Etiqueta removida: ${tag.name} (id ${id})`);

    return { status: 'tag removed' };
  }
}
