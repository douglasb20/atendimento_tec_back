import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';

import { Schedules } from './entities/schedules.entity';

@Injectable()
export class SchedulesRepository extends Repository<Schedules> {
  constructor(dataSource: DataSource) {
    super(Schedules, dataSource.manager);
  }

  async buscarPorId(id: number): Promise<Schedules> {
    const compromisso = await this.findOne({
      where: { id },
      relations: ['responsavel', 'cliente', 'contato'],
    });

    if (!compromisso) throw new NotFoundException('Compromisso não encontrado');
    return compromisso;
  }

  async listarNoIntervalo(inicio: Date, fim: Date, userId?: number): Promise<Schedules[]> {
    const query = this.createQueryBuilder('compromisso')
      .leftJoinAndSelect('compromisso.responsavel', 'responsavel')
      .leftJoinAndSelect('compromisso.cliente', 'cliente')
      .leftJoinAndSelect('compromisso.contato', 'contato')
      .where('compromisso.starts_at < :fim', { fim })
      .andWhere('compromisso.ends_at > :inicio', { inicio })
      .orderBy('compromisso.starts_at', 'ASC');

    if (userId !== undefined) query.andWhere('compromisso.user_id = :userId', { userId });

    return query.getMany();
  }

  async conflitos(userId: number, inicio: Date, fim: Date, ignorarId?: number): Promise<Schedules[]> {
    const query = this.createQueryBuilder('compromisso')
      .leftJoinAndSelect('compromisso.responsavel', 'responsavel')
      .where('compromisso.user_id = :userId', { userId })
      .andWhere('compromisso.starts_at < :fim', { fim })
      .andWhere('compromisso.ends_at > :inicio', { inicio })
      .orderBy('compromisso.starts_at', 'ASC');

    if (ignorarId !== undefined) query.andWhere('compromisso.id != :ignorarId', { ignorarId });
    return query.getMany();
  }

  async listarAtendentes(): Promise<{ id: number; name: string; last_name: string | null; schedule_color: string; email: string; avatar_url: string | null }[]> {
    return this.manager
      .createQueryBuilder()
      .select('usuario.id', 'id')
      .addSelect('usuario.name', 'name')
      .addSelect('usuario.last_name', 'last_name')
      .addSelect('usuario.schedule_color', 'schedule_color')
      // E-mail e foto: o app lista o responsável como o Google Agenda (foto, nome, e-mail).
      .addSelect('usuario.email', 'email')
      .addSelect('usuario.avatar_url', 'avatar_url')
      .from('users', 'usuario')
      .where('usuario.status = :status', { status: 1 })
      // Usuário master é operador técnico da instalação, não atendente a quem
      // se atribui um compromisso.
      .andWhere('COALESCE(usuario.is_superuser, 0) = 0')
      .orderBy('usuario.name', 'ASC')
      .addOrderBy('usuario.last_name', 'ASC')
      .getRawMany();
  }
}
