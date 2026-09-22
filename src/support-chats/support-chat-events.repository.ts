import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { SupportChatEvents, SupportChatEventType } from './entities/support-chat-events.entity';

@Injectable()
export class SupportChatEventsRepository extends Repository<SupportChatEvents> {
  constructor(dataSource: DataSource) {
    super(SupportChatEvents, dataSource.manager);
  }

  /**
   * Grava a transferência.
   *
   * Recebe o `manager` para entrar na mesma transação da troca de dono: o
   * evento sem a troca seria um registro de algo que não aconteceu, e a troca
   * sem o evento apagaria o histórico que esta tabela existe para guardar.
   */
  async registraTransferencia(
    support_chat_id: number,
    user_origem_id: number,
    user_destino_id: number | null,
    motivo: string | null,
    manager: EntityManager,
  ): Promise<SupportChatEvents> {
    const repo = manager.getRepository(SupportChatEvents);

    return repo.save(
      repo.create({
        support_chat_id,
        tipo: SupportChatEventType.TRANSFERENCIA,
        user_origem_id,
        user_destino_id,
        motivo,
      }),
    );
  }

  /**
   * Eventos da conversa, em ordem, com os nomes de quem transferiu e de quem
   * recebeu - é o que a bolha na tela mostra.
   */
  async findPorConversa(support_chat_id: number): Promise<SupportChatEvents[]> {
    return this.find({
      where: { support_chat_id },
      relations: ['userOrigem', 'userDestino'],
      order: { created_at: 'ASC' },
    });
  }
}
