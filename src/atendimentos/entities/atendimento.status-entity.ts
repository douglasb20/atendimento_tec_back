import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Atendimento } from "./atendimento-entity";


@Entity({name: 'atendimento_status'})
export class AtendimentoStatus{
  @PrimaryGeneratedColumn('increment')
  id: number

  @Column({ type: 'varchar', length: '25' })
  descricao: string;

  @OneToMany(() => Atendimento, (atendimento) => atendimento.atendimento_status)
  atendimentos: Atendimento[];
}