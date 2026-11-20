import { Injectable } from '@nestjs/common';
import { In } from 'typeorm';

import { DevicesRepository } from './devices.repository';

/** Celulares registrados para push. */
@Injectable()
export class DevicesService {
  constructor(private readonly repository: DevicesRepository) {}

  /**
   * Registra o celular do usuário logado, ou atualiza o já registrado.
   *
   * Upsert pelo token: o mesmo aparelho com outro usuário logado **passa a ser
   * dele**, e o anterior deixa de receber os avisos nesse celular.
   */
  async registrar(userId: number, token: string, nome?: string | null): Promise<void> {
    await this.repository.upsert({ user_id: userId, token, nome: nome ?? null, last_seen_at: new Date() }, ['token']);
  }

  /** Remove pelo token. Inexistente não é erro (saída repetida, token já limpo). */
  async removerPorToken(token: string): Promise<void> {
    await this.repository.delete({ token });
  }

  /** Celulares de usuários ativos: os candidatos a receber push. */
  async ativos(): Promise<{ user_id: number; token: string }[]> {
    return this.repository.ativos();
  }

  async tokensDe(userIds: number[]): Promise<{ user_id: number; token: string }[]> {
    if (!userIds.length) return [];
    const linhas = await this.repository.find({ where: { user_id: In(userIds) }, select: ['user_id', 'token'] });
    return linhas.map((l) => ({ user_id: l.user_id, token: l.token }));
  }
}
