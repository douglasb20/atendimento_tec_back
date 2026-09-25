import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ChannelStatus } from '@types';
import { DataSource, Not, Repository } from 'typeorm';
import { Channels } from './entities/channels.entity';

@Injectable()
export class ChannelsRepository extends Repository<Channels> {
  private readonly logger = new Logger(ChannelsRepository.name);
  constructor(dataSource: DataSource) {
    super(Channels, dataSource.manager);
  }

  async findActives() {
    return this.find({
      where: { channel_status_id: Not(5), deleted_at: null },
      // `integration` entra para a tela mostrar qual provider atende o canal -
      // sem isso não há como distinguir um canal que usa a integração padrão de
      // outro apontando para um servidor próprio.
      relations: ['channelStatus', 'integration'],
    });
  }

  /**
   * Um canal conectado, para operações que não partem de uma conversa.
   *
   * O cadastro manual de contato precisa perguntar ao provider se o número tem
   * WhatsApp, mas não tem canal em mãos - diferente de todo o resto, que chega
   * aqui a partir de uma mensagem. Qualquer canal conectado serve: a consulta é
   * sobre o número do contato, não sobre a sessão.
   *
   * `null` quando nenhum está conectado; quem chama decide o que fazer.
   */
  async findQualquerConectado(): Promise<Channels | null> {
    return this.findOne({
      where: { channel_status_id: ChannelStatus.CONNECTED, deleted_at: null },
      order: { id: 'ASC' },
    });
  }

  /**
   * O canal, só se estiver conectado - usado ao criar uma conversa nova
   * (`SupportChatsService.criarNova`): mandar mensagem por um canal
   * desconectado falharia na hora do envio, então a checagem entra antes de
   * gastar uma transação criando contato/conversa.
   */
  async findByIdConectado(id: number): Promise<Channels> {
    const channel = await this.findOne({
      where: { id, channel_status_id: ChannelStatus.CONNECTED, deleted_at: null },
    });

    if (!channel) {
      throw new BadRequestException('Canal não encontrado ou não está conectado');
    }

    return channel;
  }

  async findBySessionId(session_id: string, emitError = true) {
    const channel = await this.findOne({ where: { session_id }, relations: ['channelStatus'] });
    if (!channel) {
      this.logger.error(`Canal não encontrado com session_id: ${session_id}`);
      if (emitError) {
        throw new NotFoundException(`Canal não encontrado com session_id: ${session_id}`);
      }
    }
    return channel;
  }

  /**
   * Igual ao findBySessionId, mas incluindo o `instance_token` (marcado como
   * `select: false` na entidade). Uso restrito à camada de provider.
   */
  async findBySessionIdWithToken(session_id: string, emitError = true) {
    const channel = await this.createQueryBuilder('c')
      .leftJoinAndSelect('c.channelStatus', 'channelStatus')
      .addSelect('c.instance_token')
      .where('c.session_id = :session_id', { session_id })
      .getOne();

    if (!channel) {
      this.logger.error(`Canal não encontrado com session_id: ${session_id}`);
      if (emitError) {
        throw new NotFoundException(`Canal não encontrado com session_id: ${session_id}`);
      }
    }
    return channel;
  }
}
