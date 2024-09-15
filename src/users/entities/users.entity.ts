import { Atendimento } from 'atendimentos/entities/atendimento-entity';
import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Users {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: 50 })
  name: string;

  @Column({ length: 90 })
  email: string;

  @Column({ select: false })
  password: string;

  @Column({ default: 1, nullable: true })
  status: number;

  @Column({ default: 0 })
  is_requestpassword: number;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @CreateDateColumn({ type: 'timestamp' })
  lastlogin_at: Date;

  @OneToMany(() => Atendimento, (atendimento) => atendimento.clients)
  atendimentos: Atendimento[];
}
