import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

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
  ) {}

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

      paraGravar.push({ chave, valor: String(Boolean(valor)) });
    }

    if (!paraGravar.length) return;

    await runInTransaction(this.dataSource, async (manager) => {
      for (const { chave, valor } of paraGravar) {
        await this.repository.grava(chave, valor, updated_by, manager);
      }
    });

    this.logger.log(
      `Ajustes de atendimento atualizados por ${updated_by ?? 'desconhecido'}: ${paraGravar.map((p) => p.chave).join(', ')}`,
    );
  }
}
