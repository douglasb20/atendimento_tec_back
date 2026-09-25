import { Column, CreateDateColumn, Entity, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';

import { Users } from '@/users/entities/users.entity';

/**
 * Setor de atendimento: agrupa os usuários que atendem um assunto.
 *
 * Ver a migration `1789610000000` para o que o setor faz nesta entrega e o que
 * fica para depois.
 *
 * Horário de atendimento vive em `DepartmentSchedules` (tabela filha, uma
 * linha por intervalo) - decisão de 24/09/2026, revertendo um comentário
 * anterior que descartava horário no setor em favor de um bloco no fluxo do
 * chatbot. As duas coisas convivem: o setor tem horário próprio para uso
 * geral, e o chatbot (quando implementar os nós de horário) pode referenciar
 * este cadastro em vez de duplicar a configuração.
 */
@Entity('departments')
export class Departments {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  description: string | null;

  /** Texto exibido ao contato fora do horário configurado - vazio quando o
   * setor não tem horário (sempre disponível) ou simplesmente não define uma
   * mensagem própria. */
  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  absence_message: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({
    type: 'timestamptz',
    nullable: true,
    default: null,
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date | null;

  /** Soft delete, como em `tags`. */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  deleted_at: Date | null;

  // == Relations ==

  /** Lado inverso; o `@JoinTable` fica em `Users`. */
  @ManyToMany(() => Users, (user) => user.departments)
  users: Users[];
}
