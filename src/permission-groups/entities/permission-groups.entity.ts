import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { Permissions } from '@/permissions/entities/permission.entity';
import { Users } from '@/users/entities/users.entity';

/** Conjunto nomeado de permissões, atribuído aos usuários. */
@Entity('permission_groups')
export class PermissionGroups {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 60 })
  name: string;

  @Column({ type: 'varchar', length: 150, nullable: true, default: null })
  description: string | null;

  /**
   * Grupo de fábrica: as permissões podem ser ajustadas, o grupo não pode ser
   * excluído. Sem isso, apagar "Administrador" deixaria o sistema sem ninguém
   * capaz de recriá-lo.
   */
  @Column({ type: 'boolean', default: false })
  is_system: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({
    type: 'timestamptz',
    nullable: true,
    default: null,
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date | null;

  /** Soft delete, como em `integrations` e `tags`. */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  deleted_at: Date | null;

  // == Relations ==

  /**
   * As permissões do grupo. O `@JoinTable` fica deste lado porque é por aqui
   * que a sincronização acontece: salvar o grupo com uma lista nova de
   * permissões faz o TypeORM acertar a tabela do meio sozinho.
   */
  @ManyToMany(() => Permissions, { cascade: false })
  @JoinTable({
    name: 'permission_group_x_permission',
    joinColumn: { name: 'permission_group_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'permission_id', referencedColumnName: 'id' },
  })
  permissions: Permissions[];

  /**
   * Usado para recusar a exclusão de um grupo ainda em uso.
   *
   * Aponta para `permissionGroup`, não para `role`: esta última é a coluna varchar
   * legada que ainda existe em `users` e não tem relação com os grupos.
   */
  @OneToMany(() => Users, (user) => user.permissionGroup)
  users: Users[];
}
