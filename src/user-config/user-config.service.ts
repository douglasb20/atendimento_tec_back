import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { runInTransaction } from 'Utils';
import {
  ChavePreferencia,
  DEFINICOES,
  DefinicaoPreferencia,
  ehChaveValida,
  padroes,
  PreferenciasUsuario,
} from './user-config.catalogo';
import { UserConfigRepository } from './user-config.repository';

/** Uma preferência com a definição e o valor em vigor, para a tela montar. */
export type PreferenciaParaTela = DefinicaoPreferencia & {
  chave: string;
  valor: string | boolean;
};

@Injectable()
export class UserConfigService {
  private readonly logger = new Logger(UserConfigService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly repository: UserConfigRepository,
  ) {}

  /**
   * As preferências de um usuário, com padrão para o que não foi gravado.
   *
   * ⚠️ **Sem cache**, ao contrário de `SystemSettingsService`. Lá um mapa
   * global de 60s serve a todas as requisições; aqui seria um mapa por usuário,
   * e a escrita de qualquer um teria de invalidar o certo. O volume também é
   * outro: isto é lido no login e ao abrir o perfil, não a cada requisição de
   * domínio.
   */
  async paraUsuario(userId: number): Promise<PreferenciasUsuario> {
    const preferencias = padroes();

    for (const linha of await this.repository.doUsuario(userId)) {
      if (!ehChaveValida(linha.chave)) continue; // chave removida do catálogo

      preferencias[linha.chave] = this.converte(linha.chave, linha.valor);
    }

    return preferencias;
  }

  /**
   * O catálogo com os valores em vigor, para o modal de perfil montar os campos.
   *
   * @param ehSuperusuario esconde o que não se aplica a ele - hoje só a
   * notificação do chat interno, de que ele não participa.
   */
  async paraTela(userId: number, ehSuperusuario = false): Promise<PreferenciaParaTela[]> {
    const valores = await this.paraUsuario(userId);

    return Object.entries(DEFINICOES)
      .filter(([, def]) => !(ehSuperusuario && def.ocultaParaSuperusuario))
      .map(([chave, def]) => ({
        ...def,
        chave,
        valor: valores[chave as ChavePreferencia],
      }));
  }

  /**
   * Grava as preferências enviadas.
   *
   * Só o que vem no objeto é tocado - o que não vier fica como está. Isso
   * permite à tela mandar apenas o que mudou.
   */
  async atualizar(
    userId: number,
    valores: Record<string, string | boolean>,
  ): Promise<PreferenciasUsuario> {
    const entradas = Object.entries(valores);

    if (!entradas.length) throw new BadRequestException('Nenhuma preferência informada');

    await runInTransaction(this.dataSource, async (manager) => {
      for (const [chave, valor] of entradas) {
        if (!ehChaveValida(chave)) {
          throw new BadRequestException(`Preferência desconhecida: ${chave}`);
        }

        await this.repository.grava(userId, chave, this.valida(chave, valor), manager);
      }
    });

    this.logger.log(`Preferências atualizadas (usuário ${userId}): ${entradas.length} chave(s)`);

    return this.paraUsuario(userId);
  }

  /** O texto do banco vira o tipo que o catálogo declara. */
  private converte(chave: ChavePreferencia, valor: string): string | boolean {
    return DEFINICOES[chave].tipo === 'booleano' ? valor === 'true' : valor;
  }

  /**
   * Valida contra o catálogo e devolve o texto a gravar.
   *
   * ⚠️ As opções de `tema` e `modo_tema` vêm de `temas.ts`, a mesma lista que o
   * `PreferenciasTemaDto` usava com `@IsIn`. A validação mudou de lugar, não
   * sumiu: sem ela, um tema inexistente entraria no banco e o front tentaria
   * carregar um CSS que não existe.
   */
  private valida(chave: ChavePreferencia, valor: string | boolean): string {
    const def = DEFINICOES[chave];

    if (def.tipo === 'booleano') {
      if (typeof valor !== 'boolean') {
        throw new BadRequestException(`${def.rotulo}: informe verdadeiro ou falso`);
      }

      return String(valor);
    }

    const texto = String(valor);

    if (def.opcoes && !def.opcoes.includes(texto)) {
      throw new BadRequestException(`${def.rotulo}: valor inválido`);
    }

    return texto;
  }
}
