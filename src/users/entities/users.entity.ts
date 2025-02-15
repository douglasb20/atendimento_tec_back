import { Atendimentos } from 'atendimentos/entities/atendimento-entity';
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

  @Column({ default: null, nullable: true, type: 'decimal' })
  valor_hora: number;

  @Column({ default: 0 })
  is_requestpassword: number;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'datetime' })
  lastlogin_at: Date;

  @Column({ default: 'USER' })
  role: string;

  @Column({ default: 0, nullable: true })
  is_superuser: number;

  @Column({ default: 1, nullable: true })
  status: number;

  @OneToMany(() => Atendimentos, (atendimentos) => atendimentos.users)
  atendimentos: Atendimentos[];
}
