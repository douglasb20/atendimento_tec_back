import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Tipos de anexo aceitos, no vocabulário que o provider entende. */
export type TipoAnexo = 'image' | 'video' | 'audio' | 'document';

/**
 * Mensagem pronta que o atendente insere digitando `/atalho` na conversa.
 *
 * Compartilhada: o objetivo é padronizar o que a empresa responde.
 */
@Entity('quick_replies')
export class QuickReplies {
  @PrimaryGeneratedColumn('increment')
  id: number;

  /** Sem a barra - ela é o gatilho na caixa de mensagem, não parte do nome. */
  @Column({ type: 'varchar', length: 40 })
  atalho: string;

  /** Aceita a formatação do WhatsApp e as variáveis `{{nome}}`, `{{protocolo}}`… */
  @Column({ type: 'text' })
  mensagem: string;

  /**
   * A `key` do anexo no storage, **não a URL** - como `avatar_url` e
   * `media_url` fazem. A conversão acontece na leitura.
   *
   * Fica em `quick-replies/`, prefixo que o cron de retenção não varre: o
   * arquivo é do cadastro e precisa durar. No envio, o backend copia para
   * `chat/media/` e a mensagem referencia a cópia.
   */
  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  anexo_key: string | null;

  /** O nome original do arquivo, que o WhatsApp exibe ao destinatário. */
  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  anexo_nome: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, default: null })
  anexo_mimetype: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true, default: null })
  anexo_tipo: TipoAnexo | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @Column({
    type: 'timestamptz',
    nullable: true,
    default: null,
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updated_at: Date | null;

  /** Soft delete, como em `tags`. */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  deleted_at: Date | null;
}
