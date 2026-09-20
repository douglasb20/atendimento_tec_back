import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { Users } from '@/users/entities/users.entity';

/** Um ajuste do sistema. O catálogo diz como o `valor` deve ser interpretado. */
@Entity('system_settings')
export class SystemSettings {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'varchar', length: 60, unique: true })
  chave: string;

  /** Sempre string; a conversão acontece no serviço, guiada pelo catálogo. */
  @Column({ type: 'text' })
  valor: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ type: 'int', nullable: true, default: null })
  updated_by: number | null;

  @ManyToOne(() => Users, { nullable: true })
  @JoinColumn({ name: 'updated_by', referencedColumnName: 'id' })
  usuario: Users | null;
}
