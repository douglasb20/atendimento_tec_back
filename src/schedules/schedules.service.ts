import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AttendanceSettingsService } from '@/attendance-settings/attendance-settings.service';
import { Clients } from '@/clients/entities/clients.entity';
import { Contacts } from '@/contacts/entities/contacts.entity';
import { Users } from '@/users/entities/users.entity';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { Schedules } from './entities/schedules.entity';
import { SchedulesRepository } from './schedules.repository';

@Injectable()
export class SchedulesService {
  constructor(
    private readonly repository: SchedulesRepository,
    private readonly dataSource: DataSource,
    private readonly attendanceSettingsService: AttendanceSettingsService,
  ) {}

  /** A configuração operacional define a mesma regra para leitura e escrita. */
  private agendaConjunta(): Promise<boolean> {
    return this.attendanceSettingsService.getBooleano('agenda_conjunta');
  }

  private async podeVerCompromisso(compromisso: Schedules, solicitante: Users): Promise<boolean> {
    return (await this.agendaConjunta()) || compromisso.user_id === solicitante.id;
  }

  private async responsavelSolicitado(
    dto: CreateScheduleDto | UpdateScheduleDto,
    solicitante: Users,
    padrao = solicitante.id,
  ): Promise<number> {
    const responsavel = dto.user_id ?? padrao;
    if (responsavel !== solicitante.id && !(await this.agendaConjunta())) {
      throw new ForbiddenException('A agenda conjunta não está habilitada');
    }
    return responsavel;
  }

  private validarIntervalo(inicio: Date, fim: Date): void {
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime()) || fim <= inicio) {
      throw new BadRequestException('O fim do compromisso deve ser posterior ao início');
    }
  }

  private async validarVinculo(clientId?: number | null, contactId?: number | null): Promise<void> {
    if (clientId != null && contactId != null) {
      throw new BadRequestException('Associe o compromisso a um cliente ou a um contato, não aos dois');
    }

    if (clientId != null) {
      const cliente = await this.dataSource.manager.findOneBy(Clients, { id: clientId, status: 1 });
      if (!cliente) throw new BadRequestException('Cliente não encontrado');
    }

    if (contactId != null) {
      const contato = await this.dataSource.manager.findOneBy(Contacts, { id: contactId, status: 1 });
      if (!contato) throw new BadRequestException('Contato não encontrado');
    }
  }

  private async validarResponsavel(userId: number): Promise<Users> {
    const usuario = await this.dataSource.manager.findOneBy(Users, { id: userId, status: 1 });
    if (!usuario) throw new BadRequestException('Atendente responsável não encontrado');
    return usuario;
  }

  private async exigirConfirmacaoDeConflito(
    userId: number,
    inicio: Date,
    fim: Date,
    confirmado?: boolean,
    ignorarId?: number,
  ): Promise<void> {
    const conflitos = await this.repository.conflitos(userId, inicio, fim, ignorarId);
    if (conflitos.length && !confirmado) {
      throw new ConflictException({
        message: 'Há compromisso(s) neste horário para o atendente responsável',
        requer_confirmacao: true,
        conflitos,
      });
    }
  }

  async listar(inicio: string, fim: string, solicitante: Users): Promise<Schedules[]> {
    const inicioData = new Date(inicio);
    const fimData = new Date(fim);
    this.validarIntervalo(inicioData, fimData);

    return this.repository.listarNoIntervalo(
      inicioData,
      fimData,
      (await this.agendaConjunta()) ? undefined : solicitante.id,
    );
  }

  async buscarPorId(id: number, solicitante: Users): Promise<Schedules> {
    const compromisso = await this.repository.buscarPorId(id);
    if (!(await this.podeVerCompromisso(compromisso, solicitante))) {
      throw new ForbiddenException('Você não pode acessar este compromisso');
    }
    return compromisso;
  }

  async criar(dto: CreateScheduleDto, solicitante: Users): Promise<Schedules> {
    const inicio = new Date(dto.inicio_em);
    const fim = new Date(dto.fim_em);
    const userId = await this.responsavelSolicitado(dto, solicitante);
    this.validarIntervalo(inicio, fim);
    await this.validarResponsavel(userId);
    await this.validarVinculo(dto.client_id, dto.contact_id);
    await this.exigirConfirmacaoDeConflito(userId, inicio, fim, dto.confirmar_conflito);

    const compromisso = this.dataSource.manager.create(Schedules, {
      titulo: dto.titulo.trim(),
      observacao: dto.observacao?.trim() || null,
      inicio_em: inicio,
      fim_em: fim,
      lembrete_minutos: dto.lembrete_minutos,
      user_id: userId,
      client_id: dto.client_id ?? null,
      contact_id: dto.contact_id ?? null,
    });

    const salvo = await this.dataSource.manager.save(Schedules, compromisso);
    return this.repository.buscarPorId(salvo.id);
  }

  async atualizar(id: number, dto: UpdateScheduleDto, solicitante: Users): Promise<Schedules> {
    const atual = await this.buscarPorId(id, solicitante);
    // Sem `user_id`, edição preserva o responsável atual; no modo conjunto,
    // assumir o usuário que editou transferiria o compromisso em silêncio.
    const userId = await this.responsavelSolicitado(dto, solicitante, atual.user_id);
    const inicio = dto.inicio_em ? new Date(dto.inicio_em) : atual.inicio_em;
    const fim = dto.fim_em ? new Date(dto.fim_em) : atual.fim_em;
    const clientId = dto.client_id === undefined ? atual.client_id : dto.client_id;
    const contactId = dto.contact_id === undefined ? atual.contact_id : dto.contact_id;

    this.validarIntervalo(inicio, fim);
    const responsavel = await this.validarResponsavel(userId);
    await this.validarVinculo(clientId, contactId);
    await this.exigirConfirmacaoDeConflito(userId, inicio, fim, dto.confirmar_conflito, id);

    atual.titulo = dto.titulo?.trim() || atual.titulo;
    if (dto.observacao !== undefined) atual.observacao = dto.observacao?.trim() || null;
    atual.inicio_em = inicio;
    atual.fim_em = fim;
    atual.user_id = userId;
    // `atual` foi carregado com a relação anterior. Mantê-la apontando para
    // outro usuário faz o TypeORM sobrescrever `user_id` no save.
    atual.responsavel = responsavel;
    atual.client_id = clientId ?? null;
    atual.contact_id = contactId ?? null;
    if (dto.lembrete_minutos !== undefined) atual.lembrete_minutos = dto.lembrete_minutos;

    await this.dataSource.manager.save(Schedules, atual);
    return this.repository.buscarPorId(id);
  }

  async remover(id: number, solicitante: Users): Promise<{ removido: boolean }> {
    const atual = await this.buscarPorId(id, solicitante);
    await this.dataSource.manager.remove(Schedules, atual);
    return { removido: true };
  }

  async listarConflitos(dto: CreateScheduleDto, solicitante: Users): Promise<Schedules[]> {
    const inicio = new Date(dto.inicio_em);
    const fim = new Date(dto.fim_em);
    const userId = await this.responsavelSolicitado(dto, solicitante);
    this.validarIntervalo(inicio, fim);
    return this.repository.conflitos(userId, inicio, fim);
  }

  async listarAtendentes(solicitante: Users): Promise<{ id: number; name: string; last_name: string | null; schedule_color: string }[]> {
    const atendentes = await this.repository.listarAtendentes();

    return (await this.agendaConjunta())
      ? atendentes
      : atendentes.filter((atendente) => atendente.id === solicitante.id);
  }
}
