import { Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';

import { Channels } from '@/channels/entities/channels.entity';
import { runInTransaction } from '@/Utils';
import { CreateServiceAlertDto } from './dto/create-service-alert.dto';
import { UpdateServiceAlertDto } from './dto/update-service-alert.dto';
import { ServiceAlerts } from './entities/service-alerts.entity';
import { ServiceAlertsRepository } from './service-alerts.repository';

@Injectable()
export class ServiceAlertsService {
  private readonly logger = new Logger(ServiceAlertsService.name);

  constructor(
    private readonly serviceAlertsRepository: ServiceAlertsRepository,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<ServiceAlerts[]> {
    return this.serviceAlertsRepository.findAllActive();
  }

  async findOne(id: number): Promise<ServiceAlerts> {
    return this.serviceAlertsRepository.findById(id);
  }

  async create(dto: CreateServiceAlertDto): Promise<ServiceAlerts> {
    return runInTransaction(this.dataSource, async (manager) => {
      const alerta = manager.create(ServiceAlerts, {
        titulo: dto.titulo.trim(),
        mensagem: dto.mensagem,
        ativo: dto.ativo ?? true,
        expira_em: dto.expira_em ?? null,
        channels: await this.resolveCanais(manager, dto.channel_ids),
      });

      const salvo = await manager.save(ServiceAlerts, alerta);

      this.logger.log(
        `Aviso criado: "${salvo.titulo}" (id ${salvo.id}), ` +
          `${salvo.channels?.length ? salvo.channels.length + ' canal(is)' : 'todos os canais'}`,
      );

      return this.serviceAlertsRepository.findById(salvo.id);
    });
  }

  async update(id: number, dto: UpdateServiceAlertDto): Promise<ServiceAlerts> {
    const atual = await this.serviceAlertsRepository.findById(id);

    return runInTransaction(this.dataSource, async (manager) => {
      atual.titulo = dto.titulo?.trim() ?? atual.titulo;
      atual.mensagem = dto.mensagem ?? atual.mensagem;
      atual.ativo = dto.ativo ?? atual.ativo;

      // `undefined` preserva; `null` limpa o prazo. São coisas diferentes:
      // omitir o campo não pode apagar a expiração que já estava marcada.
      if (dto.expira_em !== undefined) {
        atual.expira_em = dto.expira_em;
      }

      // Mesma semântica de `tag_ids` em clientes: omitir preserva os vínculos,
      // array vazio volta a valer para todos os canais.
      if (dto.channel_ids !== undefined) {
        atual.channels = await this.resolveCanais(manager, dto.channel_ids);
      }

      await manager.save(ServiceAlerts, atual);

      this.logger.log(`Aviso atualizado: "${atual.titulo}" (id ${id}), ativo=${atual.ativo}`);

      return this.serviceAlertsRepository.findById(id);
    });
  }

  /**
   * Liga e desliga sem abrir o cadastro.
   *
   * Existe separado do `update` porque é a ação do dia a dia: o incidente
   * acabou e alguém precisa desligar o aviso em um clique, não abrindo um
   * formulário e salvando o texto de novo.
   */
  async alternarAtivo(id: number, ativo: boolean): Promise<ServiceAlerts> {
    await this.serviceAlertsRepository.findById(id);

    await runInTransaction(this.dataSource, (manager) =>
      manager.update(ServiceAlerts, id, { ativo }),
    );

    this.logger.log(`Aviso ${id} ${ativo ? 'ativado' : 'desativado'}`);

    return this.serviceAlertsRepository.findById(id);
  }

  async remove(id: number): Promise<{ removido: boolean }> {
    const alerta = await this.serviceAlertsRepository.findById(id);

    // Soft delete, como em `tags` e `quick_replies`.
    await runInTransaction(this.dataSource, (manager) =>
      manager.update(ServiceAlerts, id, { deleted_at: new Date() }),
    );

    this.logger.log(`Aviso removido: "${alerta.titulo}" (id ${id})`);

    return { removido: true };
  }

  /** Os avisos que devem sair para este canal agora. */
  async ativosParaCanal(channelId: number): Promise<ServiceAlerts[]> {
    return this.serviceAlertsRepository.findAtivosParaCanal(channelId);
  }

  /** Lista vazia vira `[]`, que é a convenção de "todos os canais". */
  private async resolveCanais(manager: EntityManager, ids?: number[]): Promise<Channels[]> {
    if (!ids?.length) return [];

    return manager.find(Channels, { where: { id: In(ids) } });
  }
}
