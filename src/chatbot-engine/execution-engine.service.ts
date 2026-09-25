import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { runInTransaction } from '@/Utils';
import { ChatbotFlowVersionsRepository } from '@/chatbots/chatbot-flow-versions.repository';
import { ChatbotFlowGraph } from '@/chatbots/entities/chatbot-flow-versions.entity';
import { Chatbots } from '@/chatbots/entities/chatbots.entity';
import { WhatsappService } from '@/whatsapp/whatsapp.service';
import { SupportChatsService, TIPO_INTERNO_POR_MIDIA } from '@/support-chats/support-chats.service';
import { SendMediaType } from '@/support-chats/dto/send-media.dto';
import { MessagesService } from '@/support-chats/messages/messages.service';
import { StorageService } from '@/storage/storage.service';
import { MessageTypes } from '@types';

import { ChatbotFlowExecutionsRepository } from './chatbot-flow-executions.repository';
import {
  CallStackFrame,
  ChatbotFlowExecutions,
} from './entities/chatbot-flow-executions.entity';
import { ExecutionBudget } from './execution-budget';
import { NodeEffect, NodeResult } from './node-handlers/node-handler.interface';
import { NodeHandlersRegistry } from './node-handlers/node-handlers.registry';
import { VariableStore } from './variable-store';

export type ExecutionTrigger =
  | { kind: 'start' }
  | { kind: 'resume'; resumePayload: Record<string, unknown> };

@Injectable()
export class ExecutionEngine {
  private readonly logger = new Logger(ExecutionEngine.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly executionsRepository: ChatbotFlowExecutionsRepository,
    private readonly flowVersionsRepository: ChatbotFlowVersionsRepository,
    private readonly nodeHandlersRegistry: NodeHandlersRegistry,
    private readonly whatsappService: WhatsappService,
    @Inject(forwardRef(() => SupportChatsService))
    private readonly supportChatsService: SupportChatsService,
    private readonly messagesService: MessagesService,
    private readonly storageService: StorageService,
  ) {}

  /** Prefixo do anexo permanente do nó Mensagem - ver `AssinarMediaDto`. */
  private static readonly PREFIXO_ANEXO_CHATBOT = 'sistema/chatbot';

  /**
   * Processa uma execução até ela suspender, terminar ou falhar. Chamado pelo
   * processor da fila - uma vez por job.
   */
  async step(executionId: number, trigger: ExecutionTrigger): Promise<void> {
    let effects: NodeEffect[] = [];
    let execucaoFinal: ChatbotFlowExecutions;

    await runInTransaction(this.dataSource, async (manager) => {
      const execucao = await this.executionsRepository.findById(executionId, manager);

      if (!execucao || execucao.status !== 'running' && execucao.status !== 'suspended') {
        this.logger.warn(`Execução ${executionId} não está pendente - ignorando job`);
        return;
      }

      const resultado = await this.runLoop(execucao, trigger, manager);
      effects = resultado.effects;
      execucaoFinal = resultado.execucao;
    });

    // Fora da transação, de propósito: chamadas ao provider do WhatsApp
    // prendem a conexão do banco pelo tempo da rede - mesmo padrão de
    // `enviaMensagemAutomatica` em `SupportChatsService`.
    await this.dispararEfeitos(execucaoFinal, effects);
  }

  private async runLoop(
    execucaoInicial: ChatbotFlowExecutions,
    trigger: ExecutionTrigger,
    manager: EntityManager,
  ): Promise<{ execucao: ChatbotFlowExecutions; effects: NodeEffect[] }> {
    let execucao = execucaoInicial;
    let currentFlowVersionId = execucao.current_flow_version_id;
    let graph = (await this.flowVersionsRepository.findById(currentFlowVersionId, manager)).graph;
    const variables = new VariableStore({ ...execucao.variables });
    const budget = new ExecutionBudget({ ...execucao.counters });
    const callStack: CallStackFrame[] = [...execucao.call_stack];
    const effectsAcumulados: NodeEffect[] = [];

    let currentNodeId = execucao.current_node_id ?? this.encontraNoInicial(graph);
    let resumePayload: Record<string, unknown> | undefined;

    if (trigger.kind === 'resume') {
      resumePayload = trigger.resumePayload;
      if (execucao.waiting_for) {
        variables.set('_last_message', trigger.resumePayload.text ?? '');
      }
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const node = graph.nodes.find((n) => n.id === currentNodeId);

      if (!node) {
        return this.persisteFalha(execucao, `Nó "${currentNodeId}" não existe no grafo`, manager);
      }

      const handler = this.nodeHandlersRegistry.resolve(node.type);
      let resultado: NodeResult;

      try {
        resultado = await handler.execute({ node, variables, budget, resumePayload });
      } catch (err) {
        return this.persisteFalha(execucao, err.message, manager);
      }

      resumePayload = undefined; // só vale para o primeiro nó após o resume

      if ('effects' in resultado && resultado.effects?.length) {
        effectsAcumulados.push(...resultado.effects);
      }

      if (resultado.kind === 'suspend') {
        return this.persisteSuspensa(execucao, {
          currentNodeId,
          currentFlowVersionId,
          variables,
          budget,
          callStack,
          waitingForNodeId: resultado.waitingFor.node_id,
          manager,
          effects: effectsAcumulados,
        });
      }

      if (resultado.kind === 'call_flow') {
        const chamada = await this.empilhaSubfluxo(
          resultado.flowId,
          currentNodeId,
          currentFlowVersionId,
          callStack,
          budget,
          manager,
        );
        graph = chamada.graph;
        currentFlowVersionId = chamada.flowVersionId;
        currentNodeId = chamada.nodeInicialId;
        continue;
      }

      if (resultado.kind === 'finish') {
        if (callStack.length > 0) {
          const frame = callStack.pop();
          const versaoPai = await this.flowVersionsRepository.findById(frame.flow_version_id, manager);
          graph = versaoPai.graph;
          currentFlowVersionId = frame.flow_version_id;
          currentNodeId = this.resolveProximoNo(graph, frame.node_id, frame.return_handle);
          continue;
        }

        return this.persisteConcluida(execucao, { variables, budget, effects: effectsAcumulados, manager });
      }

      // 'continue'
      budget.consumeTransition();
      currentNodeId = this.resolveProximoNo(graph, currentNodeId, resultado.outputHandle);
    }
  }

  private encontraNoInicial(graph: ChatbotFlowGraph): string {
    const inicio = graph.nodes.find((n) => n.type === 'start');
    return inicio?.id ?? graph.nodes[0]?.id;
  }

  private resolveProximoNo(graph: ChatbotFlowGraph, fromNodeId: string, outputHandle: string | null): string {
    const edge = graph.edges.find(
      (e) => e.source === fromNodeId && (e.sourceHandle ?? null) === (outputHandle ?? null),
    );

    if (!edge) {
      throw new Error(`Nenhuma ligação a partir de "${fromNodeId}" pela saída "${outputHandle}"`);
    }

    return edge.target;
  }

  /**
   * `chatbotId` é o fluxo complementar referenciado pelo nó "Executar Fluxo"
   * - sempre resolvido para a versão **publicada** vigente dele, nunca o
   * draft (editar um subfluxo não pode afetar quem já está executando outro
   * fluxo que o chama).
   */
  private async empilhaSubfluxo(
    chatbotId: number,
    nodeAtualId: string,
    parentFlowVersionId: number,
    callStack: CallStackFrame[],
    budget: ExecutionBudget,
    manager: EntityManager,
  ): Promise<{ graph: ChatbotFlowGraph; flowVersionId: number; nodeInicialId: string }> {
    // Recursão em runtime: este chatbot já está em algum frame da pilha?
    if (callStack.some((f) => f.chatbot_id === chatbotId)) {
      throw new Error(`Recursão detectada: o fluxo ${chatbotId} já está na pilha de execução`);
    }

    budget.assertStackDepth(callStack.length + 1);

    const subfluxo = await manager.getRepository(Chatbots).findOne({ where: { id: chatbotId } });

    if (!subfluxo?.current_published_version_id) {
      throw new Error(`Fluxo complementar ${chatbotId} não tem versão publicada`);
    }

    const versao = await this.flowVersionsRepository.findById(
      subfluxo.current_published_version_id,
      manager,
    );

    if (!versao) {
      throw new Error(`Versão publicada do fluxo complementar ${chatbotId} não encontrada`);
    }

    // Guarda a versão do **pai** (não a do subfluxo que está entrando) - é
    // para ela que o `finish` do subfluxo precisa voltar.
    callStack.push({
      chatbot_id: chatbotId,
      flow_version_id: parentFlowVersionId,
      node_id: nodeAtualId,
      return_handle: null,
    });

    return { graph: versao.graph, flowVersionId: versao.id, nodeInicialId: this.encontraNoInicial(versao.graph) };
  }

  private async persisteSuspensa(
    execucao: ChatbotFlowExecutions,
    args: {
      currentNodeId: string;
      currentFlowVersionId: number;
      variables: VariableStore;
      budget: ExecutionBudget;
      callStack: CallStackFrame[];
      waitingForNodeId: string;
      manager: EntityManager;
      effects: NodeEffect[];
    },
  ): Promise<{ execucao: ChatbotFlowExecutions; effects: NodeEffect[] }> {
    await this.executionsRepository.salvarComLockOuFalha(
      execucao.id,
      execucao.version,
      {
        status: 'suspended',
        current_node_id: args.currentNodeId,
        current_flow_version_id: args.currentFlowVersionId,
        variables: args.variables.toJSON(),
        counters: args.budget.snapshot(),
        call_stack: args.callStack,
        waiting_for: { type: 'contact_reply', node_id: args.waitingForNodeId, since: new Date().toISOString() },
      },
      args.manager,
    );

    this.logger.log(`Execução ${execucao.id} suspensa no nó ${args.currentNodeId}`);

    return { execucao, effects: args.effects };
  }

  private async persisteConcluida(
    execucao: ChatbotFlowExecutions,
    args: { variables: VariableStore; budget: ExecutionBudget; effects: NodeEffect[]; manager: EntityManager },
  ): Promise<{ execucao: ChatbotFlowExecutions; effects: NodeEffect[] }> {
    await this.executionsRepository.salvarComLockOuFalha(
      execucao.id,
      execucao.version,
      {
        status: 'completed',
        variables: args.variables.toJSON(),
        counters: args.budget.snapshot(),
        waiting_for: null,
        finished_at: new Date(),
      },
      args.manager,
    );

    this.logger.log(`Execução ${execucao.id} concluída`);

    return { execucao, effects: args.effects };
  }

  private async persisteFalha(
    execucao: ChatbotFlowExecutions,
    motivo: string,
    manager: EntityManager,
  ): Promise<{ execucao: ChatbotFlowExecutions; effects: NodeEffect[] }> {
    this.logger.error(`Execução ${execucao.id} falhou: ${motivo}`);

    await this.executionsRepository.salvarComLockOuFalha(
      execucao.id,
      execucao.version,
      { status: 'failed', finished_at: new Date() },
      manager,
    );

    return { execucao, effects: [] };
  }

  private async dispararEfeitos(execucao: ChatbotFlowExecutions, effects: NodeEffect[]): Promise<void> {
    if (!execucao || !effects.length) return;

    const supportChat = await this.supportChatsService.findParaEnvioBot(execucao.support_chat_id);
    if (!supportChat?.contact?.remote_jid || !supportChat.channel?.session_id) {
      this.logger.warn(`Execução ${execucao.id}: sem canal/contato para enviar efeitos`);
      return;
    }

    for (const effect of effects) {
      if (effect.type === 'send_text') {
        const enviadoEm = new Date();
        const enviada = await this.whatsappService.sendMessage(
          supportChat.channel.session_id,
          supportChat.contact.remote_jid,
          effect.text,
        );

        await runInTransaction(this.dataSource, (manager) =>
          this.messagesService.saveOutgoing(
            {
              messageId: enviada.messageId,
              channel: supportChat.channel,
              supportChat,
              to: supportChat.contact.remote_jid,
              content: effect.text,
              type: MessageTypes.TEXT,
              sentAt: enviadoEm,
            },
            manager,
          ),
        );
      } else if (effect.type === 'send_media') {
        // A key permanente do anexo (cadastrada no nó, prefixo
        // `sistema/chatbot/`) nunca é usada direto no envio: o cron de
        // retenção expira mídia por mensagem enviada, sem olhar prefixo, e
        // apagaria o anexo do fluxo depois de alguns meses. Uma URL/base64
        // vinda de variável não tem esse prefixo e já é descartável por
        // natureza - não precisa de cópia.
        const ehAnexoPermanente = effect.mediaKey.startsWith(
          `${ExecutionEngine.PREFIXO_ANEXO_CHATBOT}/`,
        );

        let mediaKeyParaEnvio = effect.mediaKey;
        if (ehAnexoPermanente) {
          const extensao = extname(effect.fileName ?? '') || extname(effect.mediaKey);
          mediaKeyParaEnvio = `chat/media/${randomUUID()}${extensao}`;
          await this.storageService.copyObject(effect.mediaKey, mediaKeyParaEnvio);
        }

        const mediaUrl = this.storageService.getPublicUrl(mediaKeyParaEnvio);
        const enviadoEm = new Date();
        const enviada = await this.whatsappService.sendMedia(supportChat.channel.session_id, {
          to: supportChat.contact.remote_jid,
          mediaType: effect.mediaType,
          media: mediaUrl,
          mimetype: effect.mimetype,
          caption: effect.caption,
          fileName: effect.fileName,
        });

        // Mesma corrida documentada em `SupportChatsService.sendMedia`: a
        // Evolution dispara o webhook antes de a transação abaixo commitar,
        // e sem a reserva ele baixaria de volta a mídia recém-enviada.
        await this.messagesService.reservaEnvioComMidia(enviada.messageId, {
          mediaKey: mediaKeyParaEnvio,
          mimetype: effect.mimetype,
        });

        await runInTransaction(this.dataSource, (manager) =>
          this.messagesService.saveOutgoing(
            {
              messageId: enviada.messageId,
              channel: supportChat.channel,
              supportChat,
              to: supportChat.contact.remote_jid,
              content: effect.caption ?? '',
              type: TIPO_INTERNO_POR_MIDIA[effect.mediaType as SendMediaType],
              mediaUrl: mediaKeyParaEnvio,
              mediaType: effect.mimetype,
              fileName: effect.fileName,
              sentAt: enviadoEm,
            },
            manager,
          ),
        );
      }
    }
  }
}
