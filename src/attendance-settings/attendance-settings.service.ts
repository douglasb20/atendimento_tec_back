import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { runInTransaction } from 'Utils';
import {
  CATALOGO,
  ChaveAjusteAtendimento,
  DefinicaoAjusteAtendimento,
  DEFINICOES,
  ehChaveValida,
} from './attendance-settings.catalogo';
import { AttendanceSettingsRepository } from './attendance-settings.repository';

/** O que a tela recebe: a definição do catálogo mais o valor em vigor. */
export type AjusteAtendimentoParaTela = DefinicaoAjusteAtendimento & {
  chave: string;
  valor: boolean;
};

@Injectable()
export class AttendanceSettingsService {
  private readonly logger = new Logger(AttendanceSettingsService.name);

  constructor(
    private readonly repository: AttendanceSettingsRepository,
    private readonly dataSource: DataSource,
    private readonly eventos: EventEmitter2,
  ) {}

  /** O lock compartilhado impede iniciar/avançar um fluxo durante a desativação. */
  async chatbotHabilitado(manager?: EntityManager): Promise<boolean> {
    const [ajuste] = await (manager ?? this.dataSource).query(
      `SELECT valor FROM attendance_settings WHERE chave = 'chatbot_habilitado'${manager ? ' FOR SHARE' : ''}`,
    );
    return ajuste?.valor === 'true';
  }

  private async valores(): Promise<Map<string, string>> {
    const linhas = await this.repository.todos();
    return new Map(linhas.map((l) => [l.chave, l.valor]));
  }

  /** O valor booleano da chave: banco → padrão do catálogo. */
  async getBooleano(chave: ChaveAjusteAtendimento): Promise<boolean> {
    const doBanco = (await this.valores()).get(chave);
    if (doBanco !== undefined) return doBanco === 'true';

    return DEFINICOES[chave].padrao;
  }

  /**
   * Todos os valores em vigor, chave→valor - para quem só precisa aplicar o
   * ajuste (front do atendimento), sem os rótulos/descrições que só a tela de
   * configuração usa.
   */
  async vigentes(): Promise<Record<string, boolean>> {
    const valores = await this.valores();

    return Object.fromEntries(
      (Object.keys(CATALOGO) as ChaveAjusteAtendimento[]).map((chave) => {
        const gravado = valores.get(chave);
        return [chave, gravado !== undefined ? gravado === 'true' : DEFINICOES[chave].padrao];
      }),
    );
  }

  /** O catálogo com os valores em vigor, para a tela montar os campos. */
  async paraTela(): Promise<AjusteAtendimentoParaTela[]> {
    const valores = await this.valores();

    return (Object.keys(CATALOGO) as ChaveAjusteAtendimento[]).map((chave) => {
      const def = DEFINICOES[chave];
      const gravado = valores.get(chave);

      return { ...def, chave, valor: gravado !== undefined ? gravado === 'true' : def.padrao };
    });
  }

  /** Valida contra o catálogo e grava. */
  async atualizar(ajustes: Record<string, boolean>, updated_by: number | null): Promise<void> {
    const paraGravar: { chave: ChaveAjusteAtendimento; valor: string }[] = [];

    for (const [chave, valor] of Object.entries(ajustes)) {
      if (!ehChaveValida(chave)) {
        // Recusar em vez de ignorar: chave desconhecida quase sempre é erro de
        // digitação, e aceitar em silêncio deixaria a tabela acumulando lixo.
        throw new BadRequestException(`Ajuste desconhecido: "${chave}"`);
      }

      if (typeof valor !== 'boolean') throw new BadRequestException(`O ajuste "${chave}" deve ser booleano`);

      paraGravar.push({ chave, valor: String(Boolean(valor)) });
    }

    if (!paraGravar.length) return;

    const encaminhados: number[] = [];
    await runInTransaction(this.dataSource, async (manager) => {
      for (const { chave, valor } of paraGravar) {
        await this.repository.grava(chave, valor, updated_by, manager);
      }
      if (ajustes.chatbot_habilitado === false) {
        // Mesma ordem de locks do motor: configuração → atendimento → execução.
        const [chats] = await manager.query(`UPDATE support_chats SET support_chat_status_id = 1
          WHERE support_chat_status_id = 3 AND user_id IS NULL RETURNING id`);
        encaminhados.push(...chats.map((chat: { id: number }) => chat.id));
        await manager.query(`UPDATE chatbot_flow_executions SET status = 'aborted', waiting_for = NULL,
          finished_at = NOW(), updated_at = NOW(), version = version + 1
          WHERE status IN ('running', 'suspended')`);
      }
    });

    await this.eventos.emitAsync('atendimento.ajustes-atualizados', { encaminhados });

    this.logger.log(
      `Ajustes de atendimento atualizados por ${updated_by ?? 'desconhecido'}: ${paraGravar.map((p) => p.chave).join(', ')}`,
    );
  }
}
