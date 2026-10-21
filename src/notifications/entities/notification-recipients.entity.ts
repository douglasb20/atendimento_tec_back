import { Users } from '@/users/entities/users.entity';
import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Notifications } from './notifications.entity';

@Entity('notification_recipient')
export class NotificationRecipients {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ type: 'int' })
  notification_id: number;

  @Column({ type: 'int' })
  user_id: number;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  lida: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true, default: null })
  lida_em: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Notifications, { nullable: false })
  @JoinColumn({ name: 'notification_id' })
  notificacao: Notifications;

  @ManyToOne(() => Users, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  destinatario: Users;
}
