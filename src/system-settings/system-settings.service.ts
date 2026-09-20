import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { decrypt, encrypt, runInTransaction } from 'Utils';
import {
  CATALOGO,
  ChaveAjuste,
  DefinicaoAjuste,
  DEFINICOES,
  ehChaveValida,
  ehSegredo,
} from './system-settings.catalogo';
import { SystemSettingsRepository } from './system-settings.repository';

/** Quanto tempo os valores ficam em memória antes de reler o banco. */
const CACHE_MS = 60_000;

/** O que a tela recebe: a definição do catálogo mais o valor em vigor. */
export type AjusteParaTela = DefinicaoAjuste & {
  chave: string;
  /** Ausente nas chaves de senha — estas nunca saem da API. */
  valor?: string | number;
  /** Só para senhas: diz se há algo gravado, sem revelar o quê. */
  definido?: boolean;
};

@Injectable()
export class SystemSettingsService {
  private readonly logger = new Logger(SystemSettingsService.name);

  /**
   * Valores em memória.
   *
   * Lidos a cada pedido de senha, a cada login e a cada envio de e-mail — ir ao
   * banco toda vez seria consulta por nada. Um minuto é curto o bastante para
   * uma mudança aparecer rápido, e o `PATCH` invalida na hora de qualquer forma.
   */
  private cache: Map<string, string> | null = null;
  private cacheExpiraEm = 0;

  constructor(
    private readonly repository: SystemSettingsRepository,
    private readonly dataSource: DataSource,
  ) {}

  private async valores(): Promise<Map<string, string>> {
    if (this.cache && this.cacheExpiraEm > Date.now()) return this.cache;

    const linhas = await this.repository.todos();
    this.cache = new Map(linhas.map((l) => [l.chave, l.valor]));
    this.cacheExpiraEm = Date.now() + CACHE_MS;

    return this.cache;
  }

  private invalida(): void {
    this.cache = null;
    this.cacheExpiraEm = 0;
  }

  /**
   * O valor cru da chave: banco → variável de ambiente → padrão do catálogo.
   *
   * Senhas voltam já descriptografadas — a cifra só existe no banco.
   */
  private async bruto(chave: ChaveAjuste): Promise<string> {
    const def = DEFINICOES[chave];
    const doBanco = (await this.valores()).get(chave);

    if (doBanco !== undefined && doBanco !== '') {
      if (!ehSegredo(chave)) return doBanco;

      try {
        return decrypt(doBanco);
      } catch {
        // Gravado com outra CRYPTO_KEY, ou corrompido. Cair no ambiente é
        // melhor que devolver lixo para o servidor de e-mail.
        this.logger.warn(`Não foi possível decifrar o ajuste "${chave}"; usando o padrão.`);
      }
    }

    const doAmbiente = def.env ? process.env[def.env] : undefined;
    if (doAmbiente) return doAmbiente;

    return String(def.padrao);
  }

  /**
   * Inteiro dentro da faixa declarada.
   *
   * Valor corrompido no banco cai no padrão em vez de virar `NaN` no meio de um
   * cálculo de data — é o tipo de erro que só apareceria muito depois.
   */
  async getInteiro(chave: ChaveAjuste): Promise<number> {
    const def = DEFINICOES[chave];
    const n = Number(await this.bruto(chave));

    if (!Number.isFinite(n)) return Number(def.padrao);
    if (def.min !== undefined && n < def.min) return def.min;
    if (def.max !== undefined && n > def.max) return def.max;

    return n;
  }

  async getTexto(chave: ChaveAjuste): Promise<string> {
    return this.bruto(chave);
  }

  /** O catálogo com os valores em vigor, para a tela montar os campos. */
  async paraTela(): Promise<AjusteParaTela[]> {
    const valores = await this.valores();

    return Promise.all(
      (Object.keys(CATALOGO) as ChaveAjuste[]).map(async (chave) => {
        const def = DEFINICOES[chave];

        if (ehSegredo(chave)) {
          // A senha nunca sai daqui. A tela mostra "definida" ou "não definida"
          // e o campo em branco no PATCH significa "mantém a atual".
          const gravado = valores.get(chave);
          const doAmbiente = def.env ? process.env[def.env] : undefined;
          return { ...def, chave, definido: Boolean(gravado || doAmbiente) };
        }

        const cru = await this.bruto(chave);
        return {
          ...def,
          chave,
          valor: def.tipo === 'inteiro' ? Number(cru) : cru,
        };
      }),
    );
  }

  /** Valida contra o catálogo e grava. */
  async atualizar(
    ajustes: Record<string, string | number>,
    updated_by: number | null,
  ): Promise<void> {
    const paraGravar: { chave: ChaveAjuste; valor: string }[] = [];

    for (const [chave, valor] of Object.entries(ajustes)) {
      if (!ehChaveValida(chave)) {
        // Recusar em vez de ignorar: chave desconhecida quase sempre é erro de
        // digitação, e aceitar em silêncio deixaria a tabela acumulando lixo.
        throw new BadRequestException(`Ajuste desconhecido: "${chave}"`);
      }

      const def = DEFINICOES[chave];

      // Senha em branco: mantém a que está gravada. É o que permite salvar o
      // resto do formulário sem redigitar a credencial.
      if (ehSegredo(chave) && (valor === '' || valor === null || valor === undefined)) {
        continue;
      }

      if (def.tipo === 'inteiro') {
        const n = Number(valor);

        if (!Number.isInteger(n)) {
          throw new BadRequestException(`"${def.rotulo}" precisa ser um número inteiro.`);
        }
        if (def.min !== undefined && n < def.min) {
          throw new BadRequestException(
            `"${def.rotulo}" não pode ser menor que ${def.min}${def.unidade ? ' ' + def.unidade : ''}.`,
          );
        }
        if (def.max !== undefined && n > def.max) {
          throw new BadRequestException(
            `"${def.rotulo}" não pode passar de ${def.max}${def.unidade ? ' ' + def.unidade : ''}.`,
          );
        }

        paraGravar.push({ chave, valor: String(n) });
        continue;
      }

      paraGravar.push({
        chave,
        // Criptografada, como as credenciais de integração: é a única chave de
        // verdade nesta tabela, e ela é lida por mais caminhos que o `.env`.
        valor: ehSegredo(chave) ? encrypt(String(valor)) : String(valor),
      });
    }

    if (!paraGravar.length) return;

    await runInTransaction(this.dataSource, async (manager) => {
      for (const { chave, valor } of paraGravar) {
        await this.repository.grava(chave, valor, updated_by, manager);
      }
    });

    this.invalida();
    this.logger.log(
      `Ajustes atualizados por ${updated_by ?? 'desconhecido'}: ${paraGravar.map((p) => p.chave).join(', ')}`,
    );
  }
}
