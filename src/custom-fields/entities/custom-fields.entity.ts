import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Como o valor de um campo deve ser interpretado e editado.
 *
 * O valor é sempre gravado como texto - o banco não tem como garantir o tipo
 * numa tabela de chave-valor. Esta declaração é o que ocupa esse lugar: o
 * serviço valida contra ela na escrita, e o front monta o campo certo a partir
 * dela.
 */
export type TipoCampo = 'texto' | 'numero' | 'data' | 'booleano' | 'lista';

/** Onde o campo pode ser usado. */
export type AplicaA = 'contato' | 'cliente' | 'ambos';

export const TIPOS_VALIDOS: TipoCampo[] = ['texto', 'numero', 'data', 'booleano', 'lista'];
export const APLICA_A_VALIDOS: AplicaA[] = ['contato', 'cliente', 'ambos'];

/**
 * Campo personalizado disponível para contatos e clientes.
 *
 * ⚠️ Estar aqui **não** põe o campo em nenhum contato. Esta é a lista do que
 * pode ser escolhido; quem decide os campos de cada registro é quem edita, no
 * formulário.
 */
@Entity('custom_fields')
export class CustomFields {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ name: 'nome', type: 'varchar', length: 60 })
  nome: string;

  @Column({ name: 'tipo', type: 'varchar', length: 12 })
  tipo: TipoCampo;

  @Column({ name: 'aplica_a', type: 'varchar', length: 8 })
  aplica_a: AplicaA;

  /**
   * As opções, quando `tipo = 'lista'`; nulo nos demais.
   *
   * jsonb porque é lido inteiro para montar o seletor e nunca consultado por
   * dentro - mesmo uso de `integrations.credentials`.
   */
  @Column({ name: 'opcoes', type: 'jsonb', nullable: true })
  opcoes: string[] | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  created_at: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updated_at: Date | null;

  /** Exclusão lógica, como em `tags`: o histórico preenchido continua legível. */
  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deleted_at: Date | null;
}
