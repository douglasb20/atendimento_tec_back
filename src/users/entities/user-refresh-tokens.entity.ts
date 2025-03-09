import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { UsersEntity } from "./users.entity";

@Entity('user_refresh_tokens')
export class UserRefreshTokensEntity{

  @PrimaryGeneratedColumn('increment')
  id: number

  @Column({ type: 'int', nullable: false })
  user_id: number;

  @Column({ type: 'text', nullable: false })
  refresh_token: string;

  @CreateDateColumn({ type: 'timestamp' })
  expires_at: Date;

  @ManyToOne(() => UsersEntity, (user) => user.userRefreshTokens)
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  users: UsersEntity

}