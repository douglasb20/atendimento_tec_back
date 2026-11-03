import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { CreateOrChannelDto } from './dto/create-or-channel.dto';
import type { Channels } from './entities/channels.entity';

/** Mantém uma única origem dos vínculos: a edição do canal, sem duplicar o M:N. */
@Injectable()
export class ChatbotsDoCanalService {
  constructor(private readonly dataSource: DataSource) {}

  async opcoes() {
    const [ajuste] = await this.dataSource.query("SELECT valor FROM attendance_settings WHERE chave = 'chatbot_habilitado'");
    if (ajuste?.valor !== 'true') return [];
    return this.dataSource.query(`SELECT id, name, type, active, current_published_version_id FROM chatbots
      WHERE deleted_at IS NULL AND type IN ('entrada', 'saida') ORDER BY name`);
  }

  async carregar(canal: Channels): Promise<Channels> {
    const vinculos = await this.dataSource.query(`SELECT b.id, b.type FROM chatbots b
      JOIN channel_x_chatbot cc ON cc.chatbot_id = b.id
      WHERE cc.channel_id = $1 AND b.deleted_at IS NULL AND b.type IN ('entrada', 'saida')
      ORDER BY b.active DESC, b.id`, [canal.id]);
    canal.chatbot_entrada_id = vinculos.find((v: { type: string }) => v.type === 'entrada')?.id ?? null;
    canal.chatbot_saida_id = vinculos.find((v: { type: string }) => v.type === 'saida')?.id ?? null;
    return canal;
  }

  async salvar(canalId: number, dto: CreateOrChannelDto, manager: EntityManager): Promise<void> {
    for (const [tipo, id] of [['entrada', dto.chatbot_entrada_id], ['saida', dto.chatbot_saida_id]] as const) {
      const rotulo = tipo === 'saida' ? 'saída' : 'entrada';
      if (id === undefined) continue; // Atualizações sem estes campos preservam a associação.
      if (id !== null) {
        // Publicar/remover o fluxo espera a validação deste vínculo terminar.
        const [chatbot] = await manager.query(`SELECT id, type, deleted_at, current_published_version_id
          FROM chatbots WHERE id = $1 FOR SHARE`, [id]);
        if (!chatbot || chatbot.deleted_at || chatbot.type !== tipo) {
          throw new BadRequestException(`Escolha um chatbot de ${rotulo} válido`);
        }
        if (chatbot.current_published_version_id) {
          const [versao] = await manager.query('SELECT graph FROM chatbot_flow_versions WHERE id = $1', [chatbot.current_published_version_id]);
          const setores = await manager.query('SELECT department_id FROM channel_x_department WHERE channel_id = $1', [canalId]);
          const vinculados = new Set(setores.map((s: { department_id: number }) => Number(s.department_id)));
          for (const no of versao?.graph?.nodes ?? []) {
            if (['set_department', 'business_hours'].includes(no.type) && !vinculados.has(Number(no.data.department_id))) {
              throw new BadRequestException(`O fluxo de ${rotulo} usa um setor que não está vinculado a este canal`);
            }
          }
        }
      }
      await manager.query(`DELETE FROM channel_x_chatbot cc USING chatbots b
        WHERE cc.chatbot_id = b.id AND cc.channel_id = $1 AND b.type = $2`, [canalId, tipo]);
      if (id !== null) await manager.query('INSERT INTO channel_x_chatbot (channel_id, chatbot_id) VALUES ($1, $2)', [canalId, id]);
    }
  }

  async desabilitar(canalId: number, manager: EntityManager): Promise<number[]> {
    const [chats] = await manager.query(`UPDATE support_chats SET support_chat_status_id = 1
      WHERE channel_id = $1 AND support_chat_status_id = 3 AND user_id IS NULL RETURNING id`, [canalId]);
    const [posAtendimentos] = await manager.query(`UPDATE support_chats SET pos_atendimento_ativo = false
      WHERE channel_id = $1 AND pos_atendimento_ativo = true RETURNING id`, [canalId]);
    await manager.query(`UPDATE chatbot_flow_executions e SET status = 'aborted', waiting_for = NULL,
      finished_at = NOW(), updated_at = NOW(), version = version + 1
      FROM support_chats sc WHERE sc.id = e.support_chat_id AND sc.channel_id = $1
      AND e.status IN ('running', 'suspended')`, [canalId]);
    return [...chats, ...posAtendimentos].map((chat: { id: number }) => chat.id);
  }
}
