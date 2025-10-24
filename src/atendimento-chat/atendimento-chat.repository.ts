import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AtendimentoChats } from './entities/atendimento-chats.entity';

@Injectable()
export class AtendimentoChatsRepository extends Repository<AtendimentoChats> {
  private readonly logger = new Logger(AtendimentoChatsRepository.name);
  constructor(dataSource: DataSource) {
    super(AtendimentoChats, dataSource.manager);
  }

  async findActives() {
    this.logger.log('Initializing AtendimentoChatsRepository');
    return this.findBy({ atendimento_chat_status_id: 1 });
  }
}
