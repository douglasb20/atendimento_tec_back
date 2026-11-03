import { BadRequestException } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

export type DestinoEncaminhamento = { departmentId: number; userId: number | null };

export function lerDestinoEncaminhamento(data: Record<string, unknown>): DestinoEncaminhamento {
  if (!['department', 'user'].includes(String(data.destination))) {
    throw new BadRequestException('Escolha o destino no nó Encaminhar para atendimento');
  }
  const departmentId = Number(data.department_id);
  if (!Number.isSafeInteger(departmentId) || departmentId <= 0) {
    throw new BadRequestException('Escolha o setor no nó Encaminhar para atendimento');
  }
  const userId = data.destination === 'user' ? Number(data.user_id) : null;
  if (data.destination === 'user' && (!Number.isSafeInteger(userId) || userId <= 0)) {
    throw new BadRequestException('Escolha o atendente no nó Encaminhar para atendimento');
  }
  return { departmentId, userId };
}

/** Conferido na publicação e novamente ao executar, pois equipe e vínculos podem mudar. */
export async function validarDestinoEncaminhamento(manager: EntityManager, destino: DestinoEncaminhamento, canalId?: number): Promise<void> {
  const [setor] = await manager.query('SELECT id FROM departments WHERE id = $1 AND deleted_at IS NULL', [destino.departmentId]);
  if (!setor) throw new BadRequestException('O setor do encaminhamento não está disponível');
  if (canalId != null) {
    const [vinculo] = await manager.query('SELECT 1 FROM channel_x_department WHERE channel_id = $1 AND department_id = $2', [canalId, destino.departmentId]);
    if (!vinculo) throw new BadRequestException('O setor do encaminhamento não pertence a este canal');
  }
  if (destino.userId != null) {
    const [atendente] = await manager.query(`SELECT u.id FROM users u JOIN user_x_department ud ON ud.user_id = u.id
      WHERE u.id = $1 AND ud.department_id = $2 AND u.status = 1`, [destino.userId, destino.departmentId]);
    if (!atendente) throw new BadRequestException('O atendente do encaminhamento está inativo ou não pertence ao setor escolhido');
  }
}
