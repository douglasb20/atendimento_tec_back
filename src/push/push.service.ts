import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { DisponibilidadeSetorService } from '@/departments/disponibilidade-setor.service';
import { DevicesService } from '@/devices/devices.service';
import { AcessoAtendimentoService } from '@/permissions/acesso-atendimento.service';
import { grupoDaConversa } from '@/support-chats/grupo-conversa';
import { UserConfigService } from '@/user-config/user-config.service';
import { Aviso, EnvioFirebase } from './envio-firebase';
import { deveAvisarMensagem, deveAvisarTransferencia, previaDoAviso, tituloDaConversa } from './regras-push';

type Conversa = Parameters<typeof tituloDaConversa>[0] & {
  id: number | string;
  user_id: number | null;
  department_id: number | null;
  support_chat_status_id: number;
  paused_at?: Date | string | null;
  pos_atendimento_ativo?: boolean;
};

/**
 * Decide quem recebe o push e envia (spec da Fase 2b do app).
 *
 * Os candidatos são os donos de celular registrado, e cada um passa pelo
 * mesmo `podeVer` do portal: a regra de quem vê a conversa fica num lugar só.
 * Nunca lança: o push é acessório, e uma falha nele não pode derrubar o
 * recebimento da mensagem.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);

  constructor(
    private readonly envio: EnvioFirebase,
    private readonly devices: DevicesService,
    private readonly acesso: AcessoAtendimentoService,
    private readonly preferencias: UserConfigService,
    private readonly disponibilidade: DisponibilidadeSetorService,
    private readonly banco: DataSource,
  ) {}

  /** Um aviso de mensagem por vez (ver `avisarMensagem`). */
  private fila: Promise<void> = Promise.resolve();

  /**
   * Em fila: o push roda sem `await` depois de cada mensagem, e uma rajada
   * de mensagens disparava dezenas de verificações em paralelo, disputando as
   * conexões do banco com a fila de mensagens do WhatsApp.
   */
  avisarMensagem(chat: Conversa, mensagem: { type: string; content: string | null; from_me: boolean }): Promise<void> {
    const vez = this.fila.then(() => this.avisarMensagemAgora(chat, mensagem));
    this.fila = vez;
    return vez;
  }

  /**
   * Por candidato, do mais barato ao mais caro: preferências (que já descartam
   * a maioria), acesso, e o horário dos setores só para quem não é o dono,
   * calculado uma vez por setor.
   */
  private async avisarMensagemAgora(chat: Conversa, mensagem: { type: string; content: string | null; from_me: boolean }): Promise<void> {
    try {
      if (!this.envio.ativo || mensagem.from_me) return;
      const porUsuario = new Map<number, string[]>();
      for (const c of await this.devices.ativos()) porUsuario.set(c.user_id, [...(porUsuario.get(c.user_id) ?? []), c.token]);

      const grupo = grupoDaConversa(chat);
      const horarioDoSetor = new Map<number, Promise<boolean>>();
      const tokens: string[] = [];
      for (const [userId, dele] of porUsuario) {
        const preferencias = await this.preferencias.paraUsuario(userId);
        const ehDono = Number(chat.user_id) === userId;
        // Sem setores na conta, só as preferências decidem: se elas já dizem não, para aqui.
        if (!deveAvisarMensagem({ grupo, preferencias, ehDono, setoresAbertos: [] })) continue;
        if (!(await this.acesso.podeVer(userId, chat))) continue;
        const setoresAbertos = ehDono ? [] : await this.setoresAbertos(userId, horarioDoSetor);
        if (deveAvisarMensagem({ grupo, preferencias, ehDono, setoresAbertos })) tokens.push(...dele);
      }
      await this.enviar(tokens, { titulo: tituloDaConversa(chat), texto: previaDoAviso(mensagem), chatId: Number(chat.id), tipo: 'mensagem' });
    } catch (erro) {
      this.logger.error(`Push da mensagem da conversa ${chat?.id} falhou: ${(erro as Error).message}`);
    }
  }

  async avisarTransferencia(chat: Conversa, destinoId: number): Promise<void> {
    try {
      if (!this.envio.ativo) return;
      const tokens = (await this.devices.tokensDe([destinoId])).map((c) => c.token);
      if (!tokens.length || !deveAvisarTransferencia(await this.preferencias.paraUsuario(destinoId))) return;
      await this.enviar(tokens, { titulo: 'Conversa transferida para você', texto: tituloDaConversa(chat), chatId: Number(chat.id), tipo: 'transferencia' });
    } catch (erro) {
      this.logger.error(`Push da transferência da conversa ${chat?.id} falhou: ${(erro as Error).message}`);
    }
  }

  /** Se cada setor do usuário está no horário agora; `cache` evita recalcular o mesmo setor no mesmo aviso. */
  private async setoresAbertos(userId: number, cache: Map<number, Promise<boolean>>): Promise<boolean[]> {
    const setores: { department_id: number }[] = await this.banco.query('SELECT department_id FROM user_x_department WHERE user_id = $1', [userId]);
    return Promise.all(setores.map((s) => {
      const id = Number(s.department_id);
      if (!cache.has(id)) cache.set(id, this.disponibilidade.verificar(id).then((r) => r.disponivel));
      return cache.get(id)!;
    }));
  }

  private async enviar(tokens: string[], aviso: Aviso): Promise<void> {
    if (!tokens.length) return;
    const { invalidos } = await this.envio.enviar(tokens, aviso);
    // Celular que desinstalou o app ou limpou os dados: o Firebase recusa o token.
    if (invalidos.length) this.logger.log(`Push: ${invalidos.length} celular(es) sem o app removido(s)`);
    for (const token of invalidos) await this.devices.removerPorToken(token);
  }
}
