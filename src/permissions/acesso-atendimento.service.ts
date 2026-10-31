import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { PermissionService } from './permission.service';
import type { SupportChats } from '@/support-chats/entities/support-chats.entity';

/** Política comum à lista, às rotas individuais e aos eventos em tempo real. */
@Injectable()
export class AcessoAtendimentoService {
  constructor(private readonly banco: DataSource, private readonly permissoes: PermissionService) {}

  async escopo(usuarioId: number) {
    const [usuario] = await this.banco.query('SELECT is_superuser FROM users WHERE id = $1 AND status = 1', [usuarioId]);
    const master = Boolean(Number(usuario?.is_superuser));
    const [todosSetores, outrosAtendentes, setores] = await Promise.all([
      master || this.permissoes.hasPermission(usuarioId, ['support.chat:view_all_departments']),
      master || this.permissoes.hasPermission(usuarioId, ['support.chat:view_others']),
      this.banco.query('SELECT department_id FROM user_x_department WHERE user_id = $1', [usuarioId]),
    ]);
    return { usuarioId, todosSetores, outrosAtendentes, setores: setores.map((s: { department_id: number }) => Number(s.department_id)) };
  }

  async filtrar(query: SelectQueryBuilder<SupportChats>, usuarioId: number): Promise<void> {
    const escopo = await this.escopo(usuarioId);
    if (!escopo.todosSetores) {
      query.andWhere(`(sc.user_id = :acessoUsuario OR sc.department_id IS NULL${escopo.setores.length ? ' OR sc.department_id IN (:...acessoSetores)' : ''})`,
        { acessoUsuario: usuarioId, acessoSetores: escopo.setores });
    }
    if (!escopo.outrosAtendentes) {
      query.andWhere('(sc.support_chat_status_id != 2 OR sc.user_id IS NULL OR sc.user_id = :acessoUsuario)', { acessoUsuario: usuarioId });
    }
  }

  async podeVer(usuarioId: number, chat: Pick<SupportChats, 'user_id' | 'department_id' | 'support_chat_status_id'>): Promise<boolean> {
    const escopo = await this.escopo(usuarioId);
    const dono = Number(chat.user_id) === Number(usuarioId);
    if (!dono && chat.department_id && !escopo.todosSetores && !escopo.setores.includes(Number(chat.department_id))) return false;
    return chat.support_chat_status_id !== 2 || !chat.user_id || dono || escopo.outrosAtendentes;
  }

  async validar(usuarioId: number, id: number): Promise<void> {
    const [chat] = await this.banco.query('SELECT user_id, department_id, support_chat_status_id FROM support_chats WHERE id = $1', [id]);
    if (!chat) throw new NotFoundException('Atendimento não encontrado');
    if (!(await this.podeVer(usuarioId, chat))) throw new ForbiddenException('Você não tem acesso a este atendimento ou setor');
  }
}
