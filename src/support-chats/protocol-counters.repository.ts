import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ProtocolCounters } from './entities/protocol-counters.entity';

/**
 * O fuso que define a competência.
 *
 * O banco roda em UTC: sem converter, um atendimento aberto às 21h de 31 de
 * outubro já contaria como novembro.
 */
const FUSO = 'America/Sao_Paulo';

@Injectable()
export class ProtocolCountersRepository extends Repository<ProtocolCounters> {
  constructor(dataSource: DataSource) {
    super(ProtocolCounters, dataSource.createEntityManager());
  }

  /**
   * O próximo protocolo, no formato `AAAAMM` + sequência de 7 dígitos.
   *
   * A sequência **recomeça do 1 a cada mês**: há uma linha de contador por
   * competência, e a do mês novo nasce no próprio `INSERT`.
   *
   * ⚠️ Tudo numa instrução só, de propósito. O código anterior lia o contador,
   * somava 1 em memória e salvava depois - sem travar a linha, dois
   * atendimentos abertos ao mesmo tempo liam o mesmo valor e geravam o mesmo
   * protocolo. Aqui o `ON CONFLICT ... DO UPDATE` resolve no banco: o segundo
   * a chegar espera o primeiro e enxerga o valor já incrementado.
   *
   * O `manager` é o da transação de quem chama - o protocolo precisa nascer e
   * morrer junto com o atendimento.
   */
  async generateProtocol(manager: EntityManager): Promise<string> {
    const [linha] = (await manager.query(
      `
      INSERT INTO protocol_counters (competencia, counter)
      VALUES (to_char(NOW() AT TIME ZONE $1, 'YYYYMM'), 1)
      ON CONFLICT (competencia) DO UPDATE
        SET counter = protocol_counters.counter + 1
      RETURNING competencia, counter
      `,
      [FUSO],
    )) as { competencia: string; counter: number }[];

    return `${linha.competencia}${String(linha.counter).padStart(7, '0')}`;
  }
}
