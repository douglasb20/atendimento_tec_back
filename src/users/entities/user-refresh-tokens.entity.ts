import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Users } from './users.entity';

@Entity('user_refresh_tokens')
export class UserRefreshTokens {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int', nullable: false })
  user_id: number;

  @Column({ type: 'text', nullable: false })
  refresh_token: string;

  @CreateDateColumn({ type: 'timestamptz' })
  expires_at: Date;

  @ManyToOne(() => Users, (user) => user.userRefreshTokens)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  users: Users;
}
