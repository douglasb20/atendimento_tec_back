import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Channels } from 'channels/entities/channels.entity';
import { IntegrationProviders } from './integration-provider.entity';

@Entity('integrations')
export class Integrations {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  integration_provider_id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  base_url: string | null;

  /**
   * Credenciais do provider, gravadas criptografadas (ver IntegrationsService).
   * O formato varia conforme o provider: a Evolution usa { apiKey }, a Cloud API
   * usará { phoneNumberId, wabaId, accessToken }.
   */
  @Column({ type: 'jsonb', nullable: true, select: false })
  credentials: Record<string, string> | null;

  /**
   * URL que o provider chama de volta com os eventos. Fica na integração porque
   * cada provider pode precisar de um endereço distinto para alcançar o backend.
   */
  @Column({ type: 'varchar', length: 255, nullable: true })
  webhook_url: string | null;

  /**
   * Segredo enviado nos headers do webhook e validado no recebimento - o campo
   * `apikey` do corpo da Evolution vem nulo salvo configuração específica.
   */
  @Column({ type: 'varchar', length: 255, nullable: true, select: false })
  webhook_secret: string | null;

  @Column({ type: 'boolean', default: false })
  is_default: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', nullable: true, default: null, onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date | null;

  @Column({ type: 'timestamp', nullable: true, default: null })
  deleted_at: Date | null;

  // == Relations ==

  @ManyToOne(() => IntegrationProviders, (provider) => provider.integrations)
  @JoinColumn({ name: 'integration_provider_id' })
  integrationProvider: IntegrationProviders;

  @OneToMany(() => Channels, (channel) => channel.integration)
  channels: Channels[];
}
