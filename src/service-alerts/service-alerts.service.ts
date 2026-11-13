import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { StorageService } from '@/storage/storage.service';
import { AssinarAnexoAvisoDto } from './dto/assinar-anexo-aviso.dto';

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
    private readonly storageService: StorageService,
  ) {}

  async findAll(): Promise<ServiceAlerts[]> {
    return (await this.serviceAlertsRepository.findAllActive()).map(aviso => this.comUrlAnexo(aviso));
  }

  async findOne(id: number): Promise<ServiceAlerts> {
    return this.comUrlAnexo(await this.serviceAlertsRepository.findById(id));
  }

  async create(dto: CreateServiceAlertDto): Promise<ServiceAlerts> {
    return runInTransaction(this.dataSource, async (manager) => {
      const alerta = manager.create(ServiceAlerts, {
        titulo: dto.titulo.trim(),
        mensagem: dto.mensagem,
        ativo: dto.ativo ?? true,
        expira_em: dto.expira_em ?? null,
        channels: await this.resolveCanais(manager, dto.channel_ids),
        ...this.dadosAnexo(dto),
      });

      const salvo = await manager.save(ServiceAlerts, alerta);

      this.logger.log(
        `Aviso criado: "${salvo.titulo}" (id ${salvo.id}), ` +
          `${salvo.channels?.length ? salvo.channels.length + ' canal(is)' : 'todos os canais'}`,
      );

      // Pelo `manager`: o repository usa outra conexão, que não enxerga a
      // linha ainda não commitada e respondia "Aviso N não encontrado".
      return this.comUrlAnexo(await manager.findOne(ServiceAlerts, {
        where: { id: salvo.id },
        relations: ['channels'],
      }));
    });
  }

  async update(id: number, dto: UpdateServiceAlertDto): Promise<ServiceAlerts> {
    const atual = await this.serviceAlertsRepository.findById(id);
    const chaveAnterior = atual.anexo_key;
    const anexo = this.dadosAnexo(dto);

    const salvo = await runInTransaction(this.dataSource, async (manager) => {
      atual.titulo = dto.titulo?.trim() ?? atual.titulo;
      atual.mensagem = dto.mensagem ?? atual.mensagem;
      atual.ativo = dto.ativo ?? atual.ativo;
      Object.assign(atual, anexo);

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

      // Pelo `manager`, como em `create`: devolve os canais já regravados.
      return this.comUrlAnexo(await manager.findOne(ServiceAlerts, { where: { id }, relations: ['channels'] }));
    });
    if (dto.anexo_key !== undefined && chaveAnterior && chaveAnterior !== dto.anexo_key) {
      await this.removerAnexo(chaveAnterior);
    }
    return salvo;
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

    if (alerta.anexo_key) await this.removerAnexo(alerta.anexo_key);

    this.logger.log(`Aviso removido: "${alerta.titulo}" (id ${id})`);

    return { removido: true };
  }

  /** Os avisos que devem sair para este canal agora. */
  async ativosParaCanal(channelId: number): Promise<ServiceAlerts[]> {
    return this.serviceAlertsRepository.findAtivosParaCanal(channelId);
  }

  async assinarAnexo(dto: AssinarAnexoAvisoDto) {
    const key = `service-alerts/${randomUUID()}${extname(dto.fileName) || '.bin'}`;
    return this.storageService.createPresignedPost(key, dto.fileType);
  }

  async copiaAnexoParaEnvio(aviso: ServiceAlerts): Promise<{
    media_key: string; media_url: string; media_type: string; mimetype: string; file_name: string;
  } | null> {
    if (!aviso.anexo_key) return null;
    // A retenção das mensagens apaga somente a cópia, preservando o cadastro.
    const destino = `chat/media/${randomUUID()}${extname(aviso.anexo_nome ?? '') || '.bin'}`;
    await this.storageService.copyObject(aviso.anexo_key, destino);
    return { media_key: destino, media_url: this.storageService.getPublicUrl(destino),
      media_type: aviso.anexo_tipo, mimetype: aviso.anexo_mimetype, file_name: aviso.anexo_nome };
  }

  private dadosAnexo(dto: UpdateServiceAlertDto): Partial<ServiceAlerts> {
    if (dto.anexo_key === undefined) return {};
    if (dto.anexo_key === null) {
      return { anexo_key: null, anexo_nome: null, anexo_mimetype: null, anexo_tipo: null };
    }
    if (!dto.anexo_nome || !dto.anexo_mimetype || !dto.anexo_tipo) {
      throw new BadRequestException('Informe nome, mimetype e tipo do anexo');
    }
    return { anexo_key: dto.anexo_key, anexo_nome: dto.anexo_nome,
      anexo_mimetype: dto.anexo_mimetype, anexo_tipo: dto.anexo_tipo };
  }

  private comUrlAnexo(aviso: ServiceAlerts): ServiceAlerts {
    if (aviso?.anexo_key) {
      (aviso as ServiceAlerts & { anexo_url?: string }).anexo_url =
        this.storageService.getPublicUrl(aviso.anexo_key);
    }
    return aviso;
  }

  private async removerAnexo(key: string): Promise<void> {
    try {
      await this.storageService.deleteObject(key);
    } catch {
      this.logger.warn('Não foi possível remover o anexo anterior do aviso');
    }
  }

  /** Lista vazia vira `[]`, que é a convenção de "todos os canais". */
  private async resolveCanais(manager: EntityManager, ids?: number[]): Promise<Channels[]> {
    if (!ids?.length) return [];

    return manager.find(Channels, { where: { id: In(ids) } });
  }
}
