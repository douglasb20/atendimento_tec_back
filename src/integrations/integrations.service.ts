import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomBytes } from 'node:crypto';

import { Channels } from 'channels/entities/channels.entity';
import { decrypt, encrypt, runInTransaction } from 'Utils';
import { CreateIntegrationDto } from './dto/create-integration.dto';
import { UpdateIntegrationDto } from './dto/update-integration.dto';
import { Integrations } from './entities/integrations.entity';
import { IntegrationsRepository } from './integrations.repository';

/** Integração com as credenciais já descriptografadas, para uso interno dos providers. */
export type ResolvedIntegration = Omit<Integrations, 'credentials'> & {
  credentials: Record<string, string>;
};

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly integrationsRepository: IntegrationsRepository,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<Integrations[]> {
    return this.integrationsRepository.findAllActive();
  }

  async findOne(id: number): Promise<Integrations> {
    return this.integrationsRepository.findById(id);
  }

  async create(createIntegrationDto: CreateIntegrationDto): Promise<Integrations> {
    const { credentials, is_default, ...rest } = createIntegrationDto;

    return runInTransaction(this.dataSource, async (manager) => {
      if (is_default) {
        await manager.update(Integrations, { is_default: true }, { is_default: false });
      }

      const integration = manager.create(Integrations, {
        ...rest,
        is_default: is_default ?? false,
        credentials: credentials ? this.encryptCredentials(credentials) : null,
        webhook_secret: randomBytes(32).toString('hex'),
      });

      const saved = await manager.save(Integrations, integration);
      this.logger.log(`Integração criada: ${saved.name} (id ${saved.id})`);

      // A releitura usa o manager da transação: o repository comum abriria
      // outra conexão e não enxergaria a linha ainda não commitada.
      return manager.findOne(Integrations, {
        where: { id: saved.id },
        relations: ['integrationProvider'],
      });
    });
  }

  async update(id: number, updateIntegrationDto: UpdateIntegrationDto): Promise<Integrations> {
    const { credentials, is_default, ...rest } = updateIntegrationDto;
    await this.integrationsRepository.findById(id);

    return runInTransaction(this.dataSource, async (manager) => {
      if (is_default) {
        await manager.update(Integrations, { is_default: true }, { is_default: false });
      }

      await manager.update(Integrations, id, {
        ...rest,
        ...(is_default !== undefined && { is_default }),
        // Credenciais só são reescritas quando enviadas explicitamente.
        ...(credentials && { credentials: this.encryptCredentials(credentials) }),
      });

      this.logger.log(`Integração atualizada: id ${id}`);
      return manager.findOne(Integrations, {
        where: { id },
        relations: ['integrationProvider'],
      });
    });
  }

  async remove(id: number): Promise<{ status: string }> {
    const integration = await this.integrationsRepository.findById(id);

    const channelsCount = await this.dataSource
      .getRepository(Channels)
      .createQueryBuilder('c')
      .where('c.integration_id = :id', { id })
      .andWhere('c.deleted_at IS NULL')
      .getCount();

    if (channelsCount > 0) {
      throw new BadRequestException(
        `Não é possível remover: ${channelsCount} canal(is) ainda usam esta integração.`,
      );
    }

    await this.integrationsRepository.softDelete_(id);
    this.logger.log(`Integração removida: ${integration.name} (id ${id})`);

    return { status: 'integration removed' };
  }

  /**
   * Resolve uma integração para uso pelos providers, com as credenciais em claro.
   * Sem `id`, devolve a integração marcada como padrão.
   */
  async resolveForProvider(id?: number | null): Promise<ResolvedIntegration> {
    const integration = id
      ? await this.integrationsRepository.findByIdWithCredentials(id)
      : await this.integrationsRepository.findDefaultWithCredentials();

    if (!integration.is_active) {
      throw new BadRequestException(`A integração "${integration.name}" está inativa.`);
    }

    return {
      ...integration,
      credentials: this.decryptCredentials(integration.credentials),
    } as ResolvedIntegration;
  }

  /**
   * Segredo de webhook da integração. Sem `id` - canal ainda não vinculado -
   * cai na integração padrão, do mesmo modo que `resolveForProvider`: é a mesma
   * integração que atendeu o envio, então é dela que o evento volta.
   */
  async getWebhookSecret(id?: number | null): Promise<string | null> {
    const integration = id
      ? await this.integrationsRepository.findByIdWithCredentials(id, false)
      : await this.integrationsRepository.findDefaultWithCredentials(false);

    return integration?.webhook_secret ?? null;
  }

  private encryptCredentials(credentials: Record<string, string>): Record<string, string> {
    return Object.entries(credentials).reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key] = encrypt(String(value));
      return acc;
    }, {});
  }

  private decryptCredentials(credentials: Record<string, string> | null): Record<string, string> {
    if (!credentials) return {};

    return Object.entries(credentials).reduce<Record<string, string>>((acc, [key, value]) => {
      try {
        acc[key] = decrypt(value);
      } catch (err) {
        // Credencial gravada com outra chave (CRYPTO_KEY trocada) ou corrompida.
        this.logger.error(`Falha ao descriptografar a credencial "${key}": ${err.message}`);
        throw new BadRequestException(
          `Não foi possível ler as credenciais da integração. Cadastre-as novamente.`,
        );
      }
      return acc;
    }, {});
  }
}
