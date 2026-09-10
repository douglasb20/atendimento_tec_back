import { BadRequestException, Injectable } from '@nestjs/common';

import { Channels } from 'channels/entities/channels.entity';
import { IntegrationsService, ResolvedIntegration } from 'integrations/integrations.service';
import { EvolutionProvider } from './evolution/evolution.provider';
import { ProviderSessionRef, WhatsappProvider } from './whatsapp-provider.interface';

/**
 * Resolve a implementação de provider a partir da integração configurada.
 *
 * Cada provider é instanciado com as credenciais da sua integração, então
 * instâncias são criadas por integração (e cacheadas por id) em vez de serem
 * singletons do Nest.
 */
@Injectable()
export class ProviderFactory {
  private readonly cache = new Map<string, WhatsappProvider>();

  constructor(private readonly integrationsService: IntegrationsService) {}

  /** Provider da integração informada, ou da integração padrão quando omitida. */
  async resolve(integrationId?: number | null): Promise<WhatsappProvider> {
    const integration = await this.integrationsService.resolveForProvider(integrationId);
    const cacheKey = this.cacheKey(integration);

    const cached = this.cache.get(cacheKey);
    if (cached) return cached;

    const provider = this.instantiate(integration);
    this.cache.set(cacheKey, provider);

    return provider;
  }

  /** Provider e referência de sessão de um canal, que é o par usado nas chamadas. */
  async forChannel(
    channel: Pick<Channels, 'id' | 'session_id' | 'integration_id'> & {
      instance_token?: string | null;
    },
  ): Promise<{ provider: WhatsappProvider; session: ProviderSessionRef }> {
    if (!channel.session_id) {
      throw new BadRequestException('O canal não possui uma sessão associada.');
    }

    const provider = await this.resolve(channel.integration_id);

    return {
      provider,
      session: {
        sessionId: channel.session_id,
        instanceToken: channel.instance_token ?? null,
        channelId: channel.id,
      },
    };
  }

  /**
   * Invalida o cache — necessário quando as credenciais de uma integração mudam,
   * já que o cliente HTTP é montado na construção do provider.
   */
  invalidate(integrationId?: number): void {
    if (integrationId === undefined) {
      this.cache.clear();
      return;
    }

    for (const key of this.cache.keys()) {
      if (key.startsWith(`${integrationId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  private instantiate(integration: ResolvedIntegration): WhatsappProvider {
    const slug = integration.integrationProvider?.slug;

    switch (slug) {
      case 'evolution':
        return new EvolutionProvider(integration, this.webhookUrl(integration));
      default:
        throw new BadRequestException(
          `Provider "${slug ?? 'desconhecido'}" ainda não possui implementação.`,
        );
    }
  }

  /**
   * URL que o provider deve chamar de volta com os eventos.
   *
   * Vem da própria integração (configurável pelo portal), já que cada provider
   * pode precisar de um endereço diferente para alcançar este backend. O
   * APP_SERVER do ambiente serve apenas de fallback para integrações que ainda
   * não tenham a URL preenchida.
   */
  private webhookUrl(integration: ResolvedIntegration): string {
    if (integration.webhook_url) {
      return integration.webhook_url;
    }

    const base = (process.env.APP_SERVER ?? '').replace(/\/+$/, '');

    if (!base) {
      throw new BadRequestException(
        `A integração "${integration.name}" não tem a URL de webhook configurada. ` +
          'Informe o campo webhook_url na integração (ou defina APP_SERVER como padrão).',
      );
    }

    return `${base}/api/whatsapp/webhook`;
  }

  /** A chave inclui o updated_at para que uma troca de credencial recrie o cliente. */
  private cacheKey(integration: ResolvedIntegration): string {
    return `${integration.id}:${integration.updated_at?.getTime() ?? 0}`;
  }
}
