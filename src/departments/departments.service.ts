import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { UserRepository } from '@/users/users.repository';
import { DataSource } from 'typeorm';

import { runInTransaction } from '@/Utils';
import { DepartmentsRepository, SetorComMembros } from './departments.repository';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { UpdateDepartmentScheduleDto } from './dto/update-department-schedule.dto';
import { Departments } from './entities/departments.entity';

export type DepartmentScheduleResult = {
  intervals: { weekday: number; start_time: string; end_time: string }[];
  absence_message: string | null;
};

@Injectable()
export class DepartmentsService {
  private readonly logger = new Logger(DepartmentsService.name);

  constructor(
    private readonly departmentsRepository: DepartmentsRepository,
    private readonly userRepository: UserRepository,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<SetorComMembros[]> {
    return this.departmentsRepository.findAllActive();
  }

  async findOne(id: number): Promise<Departments> {
    return this.departmentsRepository.findById(id);
  }

  async create(dto: CreateDepartmentDto): Promise<Departments> {
    const name = dto.name.trim();

    if (await this.departmentsRepository.nomeEmUso(name)) {
      throw new ConflictException(`Já existe um setor chamado "${name}"`);
    }

    return runInTransaction(this.dataSource, async (manager) => {
      const salvo = await manager.save(Departments, {
        name,
        description: dto.description?.trim() || null,
      });

      this.logger.log(`Setor criado: ${salvo.name} (id ${salvo.id})`);

      return salvo;
    });
  }

  async update(id: number, dto: UpdateDepartmentDto): Promise<Departments> {
    const setor = await this.departmentsRepository.findById(id);
    const name = dto.name?.trim();

    if (name && (await this.departmentsRepository.nomeEmUso(name, id))) {
      throw new ConflictException(`Já existe um setor chamado "${name}"`);
    }

    return runInTransaction(this.dataSource, async (manager) => {
      // Merge parcial: campo ausente no DTO fica como está. A descrição pode
      // ser apagada de propósito, por isso o `!== undefined` em vez de truthy.
      await manager.save(Departments, {
        ...setor,
        ...(name && { name }),
        ...(dto.description !== undefined && { description: dto.description?.trim() || null }),
      });

      this.logger.log(`Setor atualizado: id ${id}`);

      // Releitura pelo manager da transação: o repository comum abriria outra
      // conexão e não enxergaria a alteração ainda não commitada.
      return manager.findOne(Departments, { where: { id } });
    });
  }

  /**
   * Os usuários ativos, com um booleano dizendo quem já está no setor.
   *
   * Serve a aba "Equipe" do cadastro de setor - a mesma associação que o
   * cadastro de usuário grava, só que editada pelo outro lado.
   */
  async membros(id: number): Promise<{ id: number; name: string; last_name: string | null; email: string; membro: boolean }[]> {
    await this.departmentsRepository.findById(id); // 404 se o setor não existir

    const usuarios = await this.userRepository.findActives();

    return usuarios.map((usuario) => ({
      id: usuario.id,
      name: usuario.name,
      last_name: usuario.last_name,
      email: usuario.email,
      membro: usuario.departments?.some((setor) => setor.id === id) ?? false,
    }));
  }

  /**
   * Substitui, de uma vez, quem está no setor.
   *
   * Espelha `UsersService.gravaSetores` do outro lado: apaga e regrava os
   * vínculos deste setor específico, sem tocar nos vínculos do usuário com
   * outros setores.
   */
  async atualizaMembros(id: number, user_ids: number[]): Promise<{ status: string; total_membros: number }> {
    await this.departmentsRepository.findById(id); // 404 se o setor não existir

    await runInTransaction(this.dataSource, async (manager) => {
      await manager.query('DELETE FROM user_x_department WHERE department_id = $1', [id]);

      for (const userId of user_ids) {
        // `ON CONFLICT DO NOTHING`: um id repetido na lista não pode quebrar a
        // gravação inteira.
        await manager.query(
          'INSERT INTO user_x_department (user_id, department_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [userId, id],
        );
      }
    });

    this.logger.log(`Membros do setor ${id} atualizados: ${user_ids.length} usuário(s)`);

    return { status: 'members updated', total_membros: user_ids.length };
  }

  /**
   * O horário de atendimento do setor - lista de intervalos por dia da
   * semana, mais a mensagem exibida fora dele. Setor sem nenhum intervalo
   * configurado está sempre disponível (comportamento de hoje).
   */
  async getSchedule(id: number): Promise<DepartmentScheduleResult> {
    const setor = await this.departmentsRepository.findById(id);
    const intervalos = await this.departmentsRepository.findSchedule(id);

    return {
      // O driver do Postgres devolve `time` como `HH:mm:ss` - a tela só
      // precisa de `HH:mm`.
      intervals: intervalos.map((i) => ({
        weekday: i.weekday,
        start_time: i.start_time.slice(0, 5),
        end_time: i.end_time.slice(0, 5),
      })),
      absence_message: setor.absence_message,
    };
  }

  /**
   * Substitui todos os intervalos do setor de uma vez - mesmo desenho de
   * `atualizaMembros`, aplicado a `department_schedules`. Sem validação de
   * overlap: dois intervalos sobrepostos no mesmo dia não são um erro, a
   * união ainda representa "disponível" nesse período.
   */
  async updateSchedule(id: number, dto: UpdateDepartmentScheduleDto): Promise<DepartmentScheduleResult> {
    const setor = await this.departmentsRepository.findById(id); // 404 se o setor não existir

    // Horário ativo (≥1 intervalo) sem mensagem de ausência deixaria o canal
    // mudo fora do expediente - a mensagem que vier no DTO vale, senão a que
    // já está gravada (a tela pode mandar só `intervals` numa chamada).
    const mensagemFinal = dto.absence_message !== undefined ? dto.absence_message?.trim() : setor.absence_message;

    if (dto.intervals.length > 0 && !mensagemFinal) {
      throw new BadRequestException(
        'Informe a mensagem de ausência antes de ativar o horário de atendimento',
      );
    }

    await runInTransaction(this.dataSource, async (manager) => {
      await this.departmentsRepository.substituiSchedule(id, dto.intervals, manager);

      if (dto.absence_message !== undefined) {
        await manager.update(Departments, id, {
          absence_message: dto.absence_message?.trim() || null,
        });
      }
    });

    this.logger.log(`Horário do setor ${id} atualizado: ${dto.intervals.length} intervalo(s)`);

    return this.getSchedule(id);
  }

  /**
   * Remove o setor e desfaz os vínculos com os usuários.
   *
   * ⚠️ **Diferente de `tags`, que recusa remover em uso.** Lá a etiqueta sai do
   * cliente pela tela do cliente; aqui a associação vive no cadastro do usuário,
   * e recusar obrigaria a abrir usuário por usuário só para poder remover o
   * setor. A tela confirma antes, dizendo quantos saem.
   */
  async remove(id: number): Promise<{ status: string; usuarios_desvinculados: number }> {
    const setor = await this.departmentsRepository.findById(id);

    const desvinculados = await runInTransaction(this.dataSource, async (manager) => {
      const total = await this.departmentsRepository.contarUsuarios(id, manager);

      await manager.query('DELETE FROM user_x_department WHERE department_id = $1', [id]);
      await manager.update(Departments, id, { deleted_at: new Date() });

      return total;
    });

    this.logger.log(
      `Setor removido: ${setor.name} (id ${id}), ${desvinculados} usuário(s) desvinculado(s)`,
    );

    return { status: 'department removed', usuarios_desvinculados: desvinculados };
  }
}
