import { Supports } from 'supports/entities/supports.entity';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserRefreshTokens } from './user-refresh-tokens.entity';
import { PermissionXUser } from 'permissions/entities/permission-x-user.entity';
import { SupportChats } from 'support-chats/entities/support-chats.entity';
import { PermissionGroups } from 'permission-groups/entities/permission-groups.entity';

@Entity('users')
export class Users {
  @PrimaryGeneratedColumn('increment')
  id: number;

  /** Primeiro nome. */
  @Column({ length: 50 })
  name: string;

  /** Sobrenome, opcional. */
  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  last_name: string | null;

  @Column({ length: 90 })
  email: string;

  @Column({ select: false })
  password: string;

  @Column({ default: null, nullable: true, type: 'decimal' })
  valor_hora: number;

  @Column({ default: null, type: 'varchar', length: 200, nullable: true })
  avatar_url: string;

  @Column({ default: 0 })
  is_requestpassword: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({ type: 'timestamptz' })
  lastlogin_at: Date;

  /**
   * Coluna legada, anterior aos grupos. Nenhum guard a lê - quem decide acesso
   * é `permission_group_id`. Mantida porque removê-la é escopo à parte.
   */
  @Column({ default: 'USER' })
  role: string;

  /** Nulo é válido: usuário sem grupo não tem permissão alguma. */
  @Column({ type: 'int', nullable: true, default: null })
  permission_group_id: number | null;

  @Column({ default: 0, nullable: true })
  is_superuser: number;

  @Column({ default: 1, nullable: true })
  status: number;

  /**
   * Cor escolhida para a interface (`automatec`, `verde`, `roxo`…).
   *
   * ⚠️ Nulo = nunca escolheu; o front usa o padrão. Os valores válidos vivem
   * em `front/scripts/temas.config.mjs` e são conferidos no DTO.
   */
  @Column({ type: 'varchar', length: 20, nullable: true, default: null })
  tema: string | null;

  /** `claro`, `escuro` ou `dim`. Nulo = nunca escolheu. */
  @Column({ type: 'varchar', length: 10, nullable: true, default: null })
  modo_tema: string | null;

  // ======= Relationships =======
  @OneToMany(() => Supports, (supports) => supports.user)
  supports: Supports[];

  @ManyToOne(() => PermissionGroups, (grupo) => grupo.users, { nullable: true })
  @JoinColumn({ name: 'permission_group_id' })
  permissionGroup: PermissionGroups | null;

  /**
   * Vínculo direto usuário-permissão. Sem uso desde a adoção dos grupos; fica
   * como base para as exceções individuais (o usuário que herda do grupo e ganha
   * ou perde uma permissão pontual).
   */
  @OneToMany(() => PermissionXUser, (permissionUser) => permissionUser.user)
  permissionUser: PermissionXUser[];

  @OneToMany(() => UserRefreshTokens, (userRefreshTokens) => userRefreshTokens.users)
  userRefreshTokens: UserRefreshTokens[];

  @OneToMany(() => SupportChats, (supportChats) => supportChats.user)
  supportChats: SupportChats[];
}
