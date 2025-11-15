import { Supports } from 'supports/entities/supports.entity';
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { UserRefreshTokens } from './user-refresh-tokens.entity';
import { PermissionXUser } from 'permissions/entities/permission-x-user.entity';
import { SupportChats } from 'support-chats/entities/support-chats.entity';

@Entity('users')
export class Users {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: 50 })
  name: string;

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

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @Column({ type: 'timestamp' })
  lastlogin_at: Date;

  @Column({ default: 'USER' })
  role: string;

  @Column({ default: 0, nullable: true })
  is_superuser: number;

  @Column({ default: 1, nullable: true })
  status: number;

  // ======= Relationships =======
  @OneToMany(() => Supports, (supports) => supports.user)
  supports: Supports[];

  @OneToMany(() => PermissionXUser, (permissionUser) => permissionUser.user)
  permissionUser: PermissionXUser[];

  @OneToMany(() => UserRefreshTokens, (userRefreshTokens) => userRefreshTokens.users)
  userRefreshTokens: UserRefreshTokens[];

  @OneToMany(() => SupportChats, (supportChats) => supportChats.user)
  supportChats: SupportChats[];
}
