import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { PermissionService } from '@/permissions/permission.service';
import { runInTransaction } from 'Utils';
import { CreatePermissionGroupDto } from './dto/create-permission-group.dto';
import { UpdatePermissionGroupDto } from './dto/update-permission-group.dto';
import { PermissionGroups } from './entities/permission-groups.entity';
import { PermissionGroupsRepository } from './permission-groups.repository';

@Injectable()
export class PermissionGroupsService {
  private readonly logger = new Logger(PermissionGroupsService.name);

  constructor(
    private readonly permissionGroupsRepository: PermissionGroupsRepository,
    private readonly permissionService: PermissionService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<PermissionGroups[]> {
    return this.permissionGroupsRepository.findAllActive();
  }

  async findOne(id: number): Promise<PermissionGroups> {
    return this.permissionGroupsRepository.findById(id);
  }

  async create(dto: CreatePermissionGroupDto): Promise<PermissionGroups> {
    if (await this.permissionGroupsRepository.nomeEmUso(dto.name)) {
      throw new ConflictException(`Já existe um grupo chamado "${dto.name}"`);
    }

    const id = await runInTransaction(this.dataSource, async (manager) => {
      const grupo = manager.create(PermissionGroups, {
        name: dto.name,
        description: dto.description ?? null,
        // Grupo criado pela tela nunca é de sistema: os de fábrica vêm da
        // migration, e a proteção contra exclusão é só deles.
        is_system: false,
        permissions: await this.permissionGroupsRepository.permissoesPorIds(dto.permission_ids, manager),
      });

      const salvo = await manager.save(PermissionGroups, grupo);
      return salvo.id;
    });

    this.logger.log(`Grupo criado: ${dto.name} (id ${id})`);

    return this.permissionGroupsRepository.findById(id);
  }

  async update(id: number, dto: UpdatePermissionGroupDto): Promise<PermissionGroups> {
    const grupo = await this.permissionGroupsRepository.findById(id);

    if (dto.name && (await this.permissionGroupsRepository.nomeEmUso(dto.name, id))) {
      throw new ConflictException(`Já existe um grupo chamado "${dto.name}"`);
    }

    // Antes da escrita: depois da atualização os vínculos já mudaram, e os
    // usuários que *saíram* deste grupo não seriam alcançados.
    const usuariosAfetados = await this.permissionGroupsRepository.idsDosUsuarios(id);

    await runInTransaction(this.dataSource, async (manager) => {
      if (dto.name !== undefined) grupo.name = dto.name;
      if (dto.description !== undefined) grupo.description = dto.description;

      // Só toca nas permissões quando o campo vem no corpo. Omitido, os
      // vínculos ficam como estão - permite renomear sem reenviar a lista.
      if (dto.permission_ids !== undefined) {
        grupo.permissions = await this.permissionGroupsRepository.permissoesPorIds(
          dto.permission_ids,
          manager,
        );
      }

      await manager.save(PermissionGroups, grupo);
    });

    // O guard tem cache de 30s por usuário; sem isto, uma permissão revogada
    // seguiria valendo por meio minuto.
    usuariosAfetados.forEach((userId) => this.permissionService.invalida(userId));

    this.logger.log(`Grupo ${id} atualizado`);

    return this.permissionGroupsRepository.findById(id);
  }

  async remove(id: number): Promise<void> {
    const grupo = await this.permissionGroupsRepository.findById(id);

    if (grupo.is_system) {
      throw new BadRequestException(
        `"${grupo.name}" é um grupo do sistema e não pode ser excluído. As permissões dele podem ser alteradas.`,
      );
    }

    const vinculados = await this.permissionGroupsRepository.contarUsuariosVinculados(id);

    if (vinculados > 0) {
      throw new BadRequestException(
        `${vinculados} ${vinculados === 1 ? 'usuário usa' : 'usuários usam'} este grupo. ` +
          'Mude o grupo deles antes de excluir.',
      );
    }

    await runInTransaction(this.dataSource, async (manager) => {
      await this.permissionGroupsRepository.softDelete_(id, manager);
    });

    this.logger.log(`Grupo ${id} removido`);
  }
}
