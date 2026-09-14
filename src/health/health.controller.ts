import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Sonda usada pelo orquestrador (Docker/Coolify) para decidir se o container
 * está pronto para receber tráfego.
 *
 * Sem guard de propósito: é o proxy que chama, sem token, e a resposta não
 * revela nada além de o serviço estar de pé.
 */
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async verificar() {
    // Um `SELECT 1` basta: confirma que a conexão com o Postgres está viva, que
    // é a dependência sem a qual nenhuma rota funciona. Responder 200 com o
    // banco fora faria o proxy mandar tráfego para um container inútil.
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('Banco de dados indisponível');
    }

    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
