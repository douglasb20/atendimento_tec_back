import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { runInTransaction } from '@/Utils';
import { CustomFieldsRepository } from './custom-fields.repository';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';
import { ClientCustomValues } from './entities/client-custom-values.entity';
import { ContactCustomValues } from './entities/contact-custom-values.entity';
import { AplicaA, CustomFields } from './entities/custom-fields.entity';

@Injectable()
export class CustomFieldsService {
  private readonly logger = new Logger(CustomFieldsService.name);

  constructor(
    private readonly customFieldsRepository: CustomFieldsRepository,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(aplicaA?: Exclude<AplicaA, 'ambos'>): Promise<CustomFields[]> {
    return aplicaA
      ? this.customFieldsRepository.findPorAplicacao(aplicaA)
      : this.customFieldsRepository.findAllActive();
  }

  async findOne(id: number): Promise<CustomFields> {
    return this.customFieldsRepository.findById(id);
  }

  async create(dto: CreateCustomFieldDto): Promise<CustomFields> {
    const nome = dto.nome.trim();

    if (await this.customFieldsRepository.nomeEmUso(nome)) {
      throw new ConflictException(`Já existe um campo chamado "${nome}"`);
    }

    const opcoes = this.validaOpcoes(dto.tipo, dto.opcoes);

    const campo = await runInTransaction(this.dataSource, async (manager) => {
      const novo = manager.create(CustomFields, {
        nome,
        tipo: dto.tipo,
        aplica_a: dto.aplica_a,
        opcoes,
      });

      return manager.save(CustomFields, novo);
    });

    this.logger.log(`Campo personalizado ${campo.id} criado: ${campo.nome} (${campo.tipo})`);

    return campo;
  }

  async update(id: number, dto: UpdateCustomFieldDto): Promise<CustomFields> {
    const campo = await this.customFieldsRepository.findById(id);
    const nome = dto.nome?.trim();

    if (nome && (await this.customFieldsRepository.nomeEmUso(nome, id))) {
      throw new ConflictException(`Já existe um campo chamado "${nome}"`);
    }

    const tipoNovo = dto.tipo ?? campo.tipo;

    // Trocar o tipo com valores gravados transformaria "Indicação" em NaN, ou
    // uma data em texto solto. O campo precisa ser esvaziado antes - ou
    // cadastrado de novo, que costuma ser o que se quer de fato.
    if (dto.tipo && dto.tipo !== campo.tipo) {
      const usos = await this.customFieldsRepository.contarUsos(id);

      if (usos > 0) {
        throw new BadRequestException(
          `Não é possível mudar o tipo: ${usos} ${usos === 1 ? 'registro usa' : 'registros usam'} este campo. ` +
            'Remova o campo desses cadastros antes, ou crie um campo novo.',
        );
      }
    }

    // As opções acompanham o tipo final: virar `lista` exige informá-las, e
    // deixar de ser `lista` as descarta.
    const opcoes = this.validaOpcoes(
      tipoNovo,
      dto.opcoes ?? (tipoNovo === campo.tipo ? campo.opcoes : undefined),
    );

    const atualizado = await runInTransaction(this.dataSource, async (manager) => {
      await manager.update(CustomFields, id, {
        ...(nome && { nome }),
        ...(dto.tipo && { tipo: dto.tipo }),
        ...(dto.aplica_a && { aplica_a: dto.aplica_a }),
        opcoes,
      });

      // Releitura pelo `manager` da transação: pelo repositório a consulta
      // cairia fora dela e devolveria o estado anterior ao commit.
      return manager.findOne(CustomFields, { where: { id } });
    });

    this.logger.log(`Campo personalizado ${id} atualizado`);

    return atualizado;
  }

  async remove(id: number): Promise<void> {
    await this.customFieldsRepository.findById(id);

    const usos = await this.customFieldsRepository.contarUsos(id);

    if (usos > 0) {
      throw new BadRequestException(
        `Não é possível excluir: ${usos} ${usos === 1 ? 'registro usa' : 'registros usam'} este campo. ` +
          'Remova o campo desses cadastros antes de excluí-lo.',
      );
    }

    await runInTransaction(this.dataSource, (manager) =>
      manager.update(CustomFields, id, { deleted_at: new Date() }),
    );

    this.logger.log(`Campo personalizado ${id} excluído`);
  }

  /**
   * Valida e normaliza os valores informados para um registro.
   *
   * Vive aqui, e não em contatos/clientes, porque a regra é a mesma nos dois e
   * depende do catálogo. Devolve os pares prontos para gravar, com o valor já
   * na forma canônica - é o que garante que "1", "01" e " 1 " fiquem iguais no
   * banco e a busca futura os encontre.
   */
  async validaValores(
    valores: { custom_field_id: number; valor: string }[],
    aplicaA: Exclude<AplicaA, 'ambos'>,
    manager?: EntityManager,
  ): Promise<{ custom_field_id: number; valor: string }[]> {
    if (!valores?.length) return [];

    const ids = valores.map((v) => v.custom_field_id);

    // O mesmo campo duas vezes violaria a chave composta, e o erro cru do
    // Postgres não diria qual campo está repetido.
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('O mesmo campo foi informado mais de uma vez');
    }

    const campos = await this.customFieldsRepository.findByIds(ids, manager);
    const porId = new Map(campos.map((c) => [c.id, c]));

    return valores.map(({ custom_field_id, valor }) => {
      const campo = porId.get(custom_field_id);

      // Campo que não existe mais, ou foi excluído entre carregar a tela e
      // salvar. Recusar é melhor que ignorar: quem preencheu veria o valor
      // sumir sem explicação.
      if (!campo) {
        throw new BadRequestException(`Campo personalizado ${custom_field_id} não encontrado`);
      }

      if (campo.aplica_a !== 'ambos' && campo.aplica_a !== aplicaA) {
        throw new BadRequestException(
          `O campo "${campo.nome}" não se aplica a ${aplicaA === 'contato' ? 'contatos' : 'clientes'}`,
        );
      }

      return { custom_field_id, valor: this.normalizaValor(campo, valor) };
    });
  }

  /**
   * Substitui os valores de um registro pelos informados.
   *
   * Apaga os que sumiram e faz upsert nos demais, em vez de apagar tudo e
   * reinserir: assim o `created_at` de um valor que não mudou é preservado, e
   * o histórico continua dizendo quando aquilo foi preenchido.
   *
   * ⚠️ Roda dentro da transação de quem chama - o `manager` é obrigatório.
   */
  async sincronizaValores(
    registroId: number,
    valores: { custom_field_id: number; valor: string }[],
    destino: 'contato' | 'cliente',
    manager: EntityManager,
  ): Promise<void> {
    const entidade = destino === 'contato' ? ContactCustomValues : ClientCustomValues;
    const coluna = destino === 'contato' ? 'contact_id' : 'client_id';

    const idsInformados = valores.map((v) => v.custom_field_id);

    // Fora da lista significa removido pela tela.
    const paraApagar = manager
      .createQueryBuilder()
      .delete()
      .from(entidade)
      .where(`${coluna} = :registroId`, { registroId });

    if (idsInformados.length) {
      paraApagar.andWhere('custom_field_id NOT IN (:...ids)', { ids: idsInformados });
    }

    await paraApagar.execute();

    if (!valores.length) return;

    await manager.upsert(
      entidade,
      valores.map((v) => ({
        [coluna]: registroId,
        custom_field_id: v.custom_field_id,
        valor: v.valor,
      })) as never,
      [coluna, 'custom_field_id'],
    );
  }

  /**
   * O valor na forma canônica do tipo declarado.
   *
   * O banco guarda texto; sem esta conversão, um "sim" num campo booleano e um
   * "true" noutro registro seriam valores diferentes para a mesma coisa, e
   * nenhuma busca os juntaria.
   */
  private normalizaValor(campo: CustomFields, valorBruto: string): string {
    const valor = (valorBruto ?? '').trim();

    // Vazio não é gravado: quem apagou o conteúdo quis remover o campo, e o
    // chamador trata isso descartando o par.
    if (!valor) {
      throw new BadRequestException(`O campo "${campo.nome}" precisa de um valor`);
    }

    switch (campo.tipo) {
      case 'numero': {
        const n = Number(valor.replace(',', '.'));

        if (!Number.isFinite(n)) {
          throw new BadRequestException(`O campo "${campo.nome}" espera um número`);
        }

        return String(n);
      }

      case 'data': {
        // ISO na entrada, ISO no banco: qualquer outro formato tornaria a
        // ordenação por data uma ordenação alfabética.
        const data = new Date(valor);

        if (Number.isNaN(data.getTime())) {
          throw new BadRequestException(`O campo "${campo.nome}" espera uma data válida`);
        }

        return data.toISOString().slice(0, 10);
      }

      case 'booleano': {
        const verdadeiro = ['true', '1', 'sim'].includes(valor.toLowerCase());
        const falso = ['false', '0', 'nao', 'não'].includes(valor.toLowerCase());

        if (!verdadeiro && !falso) {
          throw new BadRequestException(`O campo "${campo.nome}" espera sim ou não`);
        }

        return verdadeiro ? 'true' : 'false';
      }

      case 'lista': {
        // Comparação sem distinguir maiúsculas, mas grava a opção como está
        // cadastrada - senão a mesma escolha apareceria de duas formas.
        const opcao = (campo.opcoes ?? []).find((o) => o.toLowerCase() === valor.toLowerCase());

        if (!opcao) {
          throw new BadRequestException(
            `"${valor}" não é uma opção de "${campo.nome}". Opções: ${(campo.opcoes ?? []).join(', ')}`,
          );
        }

        return opcao;
      }

      default:
        return valor;
    }
  }

  /**
   * As opções pertencem ao tipo `lista` e a mais nenhum.
   *
   * Sem esta checagem um campo de texto poderia guardar opções que nada lê, e
   * um campo de lista nasceria sem nada para escolher — inutilizável, e o erro
   * só apareceria na tela de quem tenta preencher.
   */
  private validaOpcoes(tipo: string, opcoes?: string[] | null): string[] | null {
    if (tipo !== 'lista') return null;

    const limpas = (opcoes ?? []).map((o) => o.trim()).filter(Boolean);

    if (!limpas.length) {
      throw new BadRequestException('Um campo do tipo lista precisa de ao menos uma opção');
    }

    // Duplicatas produziriam duas entradas idênticas no seletor, e a escolha
    // entre elas não teria como ser distinguida depois.
    const unicas = [...new Set(limpas.map((o) => o.toLowerCase()))];

    if (unicas.length !== limpas.length) {
      throw new BadRequestException('Há opções repetidas na lista');
    }

    return limpas;
  }
}
