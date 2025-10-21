import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('whatsapp_messages')
export class WhatsappMessage {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ comment: 'ID da mensagem na API externa' })
  message_id: string;

  @Column({ comment: 'Quem enviou a mensagem (ex: 5564999999999@c.us)' })
  sender: string;

  @Column({ comment: 'Quem recebeu a mensagem (seu número)' })
  receiver: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'json', comment: 'Payload completo do webhook' })
  payload: any;

  @CreateDateColumn({ type: 'timestamp' })
  received_at: Date;
}