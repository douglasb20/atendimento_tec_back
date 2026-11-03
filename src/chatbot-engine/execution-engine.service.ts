import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { runInTransaction } from '@/Utils';
import { ChatbotFlowVersionsRepository } from '@/chatbots/chatbot-flow-versions.repository';
import { ChatbotFlowGraph } from '@/chatbots/entities/chatbot-flow-versions.entity';
import { Chatbots } from '@/chatbots/entities/chatbots.entity';
import type { DestinoEncaminhamento } from '@/chatbots/encaminhamento-atendimento';
import { WhatsappService } from '@/whatsapp/whatsapp.service';
import { SupportChatsService, TIPO_INTERNO_POR_MIDIA } from '@/support-chats/support-chats.service';
import { SendMediaType } from '@/support-chats/dto/send-media.dto';
import { MessagesService } from '@/support-chats/messages/messages.service';
import { StorageService } from '@/storage/storage.service';
import { MessageTypes, SupportChatStatusId } from '@types';

import { ChatbotFlowExecutionsRepository } from './chatbot-flow-executions.repository';
import {
  CallStackFrame,
  ChatbotFlowExecutions,
  WaitingFor,
} from './entities/chatbot-flow-executions.entity';
import { ExecutionBudget } from './execution-budget';
import { NodeEffect, NodeResult } from './node-handlers/node-handler.interface';
import { NodeHandlersRegistry } from './node-handlers/node-handlers.registry';
import { VariableStore } from './variable-store';

export type ExecutionTrigger =
  | { kind: 'start' }
  | { kind: 'resume'; waitingToken?: string; resumePayload: Record<string, unknown> }
  | { kind: 'timeout'; waitingToken: string };

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
  async step(executionId: number, trigger: ExecutionTrigger, recuperandoJob = false): Promise<void> {
    let effects: NodeEffect[] = [];
    let execucaoFinal: ChatbotFlowExecutions;
    let encerrarAtendimento = false;
    let enviarDespedida = false;
    let executarFluxoSaida = false;
    let encaminhamento: DestinoEncaminhamento | undefined;

    await runInTransaction(this.dataSource, async (manager) => {
      let execucao = await this.executionsRepository.findById(executionId, manager);

      // Retry após queda entre o último envio e a liberação do protocolo:
      // não repete mensagens nem o encerramento humano, apenas conclui a reserva.
      if (recuperandoJob && execucao?.phase === 'saida' && ['completed', 'failed', 'aborted'].includes(execucao.status)) {
        execucaoFinal = execucao;
        return;
      }

      if (!execucao || execucao.status !== 'running' && execucao.status !== 'suspended') {
        this.logger.warn(`Execução ${executionId} não está pendente - ignorando job`);
        return;
      }

      if (!await this.supportChatsService.bloquearParaExecucaoBot(execucao.support_chat_id, manager, execucao.phase ?? 'entrada')) {
        await this.executionsRepository.abortarDoAtendimento(execucao.support_chat_id, manager);
        return;
      }

      // A resposta pode ter sido gravada enquanto este job aguardava o lock do chat.
      execucao = await this.executionsRepository.findById(executionId, manager);
      if (!execucao || !['running', 'suspended'].includes(execucao.status)) return;
      const espera = execucao.waiting_for;
      if (trigger.kind === 'start' && execucao.status !== 'running') return;
      if (trigger.kind !== 'start' && (execucao.status !== 'suspended' || !espera
        || trigger.waitingToken !== espera.token)) return;
      if (trigger.kind === 'timeout' && (espera.reply || !espera.timeout_at
        || Date.parse(espera.timeout_at) > Date.now())) return;

      let resultado: Awaited<ReturnType<ExecutionEngine['runLoop']>>;
      try {
        resultado = await this.runLoop(execucao, trigger, manager);
      } catch (erro) {
        // Limites de transição e fluxos ausentes também precisam liberar o protocolo.
        const falha = await this.persisteFalha(execucao, erro.message, manager);
        resultado = { ...falha, encerrarAtendimento: false, enviarDespedida: false };
      }
      effects = resultado.effects;
      execucaoFinal = resultado.execucao;
      encerrarAtendimento = resultado.encerrarAtendimento;
      enviarDespedida = resultado.enviarDespedida;
      executarFluxoSaida = resultado.executarFluxoSaida ?? false;
      encaminhamento = resultado.encaminhamento;
    });

    // Fora da transação, de propósito: chamadas ao provider do WhatsApp
    // prendem a conexão do banco pelo tempo da rede - mesmo padrão de
    // `enviaMensagemAutomatica` em `SupportChatsService`.
    if (!execucaoFinal) return;

    if (execucaoFinal.support_chat_id) {
      const chat = await this.supportChatsService.findParaEnvioBot(execucaoFinal.support_chat_id);
      if (chat) await this.supportChatsService.whatsappChatStateEmit(chat);
    }

    try {
      try {
        await this.dispararEfeitos(execucaoFinal, effects);
      } catch (erro) {
        if (!encaminhamento) throw erro;
        // Uma mensagem anterior indisponível não deve impedir a entrega ao humano.
        this.logger.warn(`Execução ${executionId}: falha no envio antes do encaminhamento: ${erro.message}`);
      }

      if (encaminhamento && execucaoFinal.phase !== 'saida') {
        await this.supportChatsService.encaminharPorChatbot(execucaoFinal.support_chat_id, encaminhamento);
      }

      const espera = execucaoFinal.waiting_for;
      if (execucaoFinal.status === 'suspended' && espera?.timeout_minutes) {
        await this.executionsRepository.renovarPrazoAposEnvio(execucaoFinal.id, espera.token, espera.timeout_minutes);
      }

      if (encerrarAtendimento && execucaoFinal.support_chat_id && execucaoFinal.phase !== 'saida') {
        await this.supportChatsService.encerrarPorChatbot(execucaoFinal.support_chat_id, enviarDespedida, executarFluxoSaida);
      }
    } finally {
      // Mantém o cliente no bot até o último envio. O UPDATE condicional não
      // desfaz uma atribuição humana nem reabre o nó Encerrar atendimento.
      if (['completed', 'failed', 'aborted'].includes(execucaoFinal.status)) {
        if (execucaoFinal.phase === 'saida') await this.supportChatsService.concluirPosAtendimento(execucaoFinal.support_chat_id);
        else await this.supportChatsService.devolverBotParaEspera(execucaoFinal.support_chat_id);
      }
    }
  }

  private async runLoop(
    execucaoInicial: ChatbotFlowExecutions,
    trigger: ExecutionTrigger,
    manager: EntityManager,
  ): Promise<{
    execucao: ChatbotFlowExecutions;
    effects: NodeEffect[];
    encerrarAtendimento: boolean;
    enviarDespedida: boolean;
    executarFluxoSaida?: boolean;
    encaminhamento?: DestinoEncaminhamento;
  }> {
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
      resumePayload = execucao.waiting_for?.reply ? { text: execucao.waiting_for.reply.text } : trigger.resumePayload;
      if (execucao.waiting_for) {
        variables.set('_last_message', resumePayload.text ?? '');
      }
    }
    if (trigger.kind === 'timeout') {
      const proximo = this.encontraProximoNo(graph, currentNodeId, execucao.waiting_for.timeout_handle);
      if (!proximo) {
        const falha = await this.persisteFalha(execucao, 'Saída Sem resposta não está conectada', manager);
        return { ...falha, encerrarAtendimento: false, enviarDespedida: false };
      }
      budget.consumeTransition();
      currentNodeId = proximo;
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const node = graph.nodes.find((n) => n.id === currentNodeId);

      if (!node) {
        const falha = await this.persisteFalha(execucao, `Nó "${currentNodeId}" não existe no grafo`, manager);
        return { ...falha, encerrarAtendimento: false, enviarDespedida: false };
      }

      const handler = this.nodeHandlersRegistry.resolve(node.type);
      let resultado: NodeResult;

      try {
        resultado = await handler.execute({ node, variables, budget, resumePayload, flowVersionId: currentFlowVersionId });
      } catch (err) {
        const falha = await this.persisteFalha(execucao, err.message, manager);
        return { ...falha, encerrarAtendimento: false, enviarDespedida: false };
      }

      resumePayload = undefined; // só vale para o primeiro nó após o resume

      if ('effects' in resultado && resultado.effects?.length) {
        effectsAcumulados.push(...resultado.effects);
      }

      if (resultado.kind === 'suspend') {
        const suspensa = await this.persisteSuspensa(execucao, {
          currentNodeId,
          currentFlowVersionId,
          variables,
          budget,
          callStack,
          waitingFor: resultado.waitingFor,
          manager,
          effects: effectsAcumulados,
        });
        return { ...suspensa, encerrarAtendimento: false, enviarDespedida: false };
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

      if (resultado.kind === 'handoff') {
        if (execucao.phase === 'saida') throw new Error('O pós-atendimento não pode encaminhar para atendimento humano');
        const destino = { departmentId: resultado.departmentId, userId: resultado.userId };
        await this.supportChatsService.validarEncaminhamentoPorChatbot(execucao.support_chat_id, destino, manager);
        const concluida = await this.persisteConcluida(execucao, {
          variables, budget, effects: effectsAcumulados, manager,
        });
        return { ...concluida, encerrarAtendimento: false, enviarDespedida: false, encaminhamento: destino };
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

        const concluida = await this.persisteConcluida(execucao, {
          variables,
          budget,
          effects: effectsAcumulados,
          manager,
        });
        return { ...concluida, encerrarAtendimento: false, enviarDespedida: false };
      }

      if (resultado.kind === 'close_support_chat') {
        const concluida = await this.persisteConcluida(execucao, {
          variables,
          budget,
          effects: effectsAcumulados,
          manager,
        });
        return {
          ...concluida,
          encerrarAtendimento: true,
          enviarDespedida: resultado.enviarDespedida,
          executarFluxoSaida: resultado.executarFluxoSaida,
        };
      }

      // 'continue'
      if (resultado.departmentId) {
        await this.supportChatsService.definirSetorPorChatbot(execucao.support_chat_id, resultado.departmentId, manager);
      }
      budget.consumeTransition();
      const proximoNoId = this.encontraProximoNo(graph, currentNodeId, resultado.outputHandle);

      // Um nó sem saída ligada é um terminal válido para o fluxo principal.
      // Isso permite, por exemplo, `Início → Mensagem` sem obrigar a pessoa a
      // adicionar um nó Finalizar só para encerrar depois do envio.
      if (!proximoNoId) {
        const concluida = await this.persisteConcluida(execucao, {
          variables,
          budget,
          effects: effectsAcumulados,
          manager,
        });
        return { ...concluida, encerrarAtendimento: false, enviarDespedida: false };
      }

      currentNodeId = proximoNoId;
    }
  }

  private encontraNoInicial(graph: ChatbotFlowGraph): string {
    const inicio = graph.nodes.find((n) => n.type === 'start');
    return inicio?.id ?? graph.nodes[0]?.id;
  }

  private resolveProximoNo(graph: ChatbotFlowGraph, fromNodeId: string, outputHandle: string | null): string {
    const proximoNoId = this.encontraProximoNo(graph, fromNodeId, outputHandle);

    if (!proximoNoId) {
      throw new Error(`Nenhuma ligação a partir de "${fromNodeId}" pela saída "${outputHandle}"`);
    }

    return proximoNoId;
  }

  private encontraProximoNo(
    graph: ChatbotFlowGraph,
    fromNodeId: string,
    outputHandle: string | null,
  ): string | null {
    // As duas posições do nó Mensagem representam a mesma continuação.
    // Grafos antigos salvam null; o editor atual identifica a posição visual.
    const saidaDaMensagem = outputHandle == null && graph.nodes.some(n => n.id === fromNodeId && n.type === 'message');
    const edge = graph.edges.find(
      (e) => e.source === fromNodeId && ((e.sourceHandle ?? null) === (outputHandle ?? null)
        || saidaDaMensagem && ['saida-direita', 'saida-inferior'].includes(e.sourceHandle)),
    );

    return edge?.target ?? null;
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
      waitingFor: Omit<WaitingFor, 'since'>;
      manager: EntityManager;
      effects: NodeEffect[];
    },
  ): Promise<{ execucao: ChatbotFlowExecutions; effects: NodeEffect[] }> {
    const espera: WaitingFor = { ...args.waitingFor, since: new Date().toISOString(), token: randomUUID(),
      ...(args.waitingFor.timeout_minutes && {
        timeout_at: new Date(Date.now() + args.waitingFor.timeout_minutes * 60000).toISOString(),
      }),
    };
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
        waiting_for: espera,
      },
      args.manager,
    );

    this.logger.log(`Execução ${execucao.id} suspensa no nó ${args.currentNodeId}`);

    return { execucao: { ...execucao, status: 'suspended', waiting_for: espera }, effects: args.effects };
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

    return { execucao: { ...execucao, status: 'completed' }, effects: args.effects };
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

    return { execucao: { ...execucao, status: 'failed' }, effects: [] };
  }

  private async dispararEfeitos(execucao: ChatbotFlowExecutions, effects: NodeEffect[]): Promise<void> {
    if (!execucao || !effects.length) return;

    const supportChat = await this.supportChatsService.findParaEnvioBot(execucao.support_chat_id);
    if (!supportChat?.contact?.remote_jid || !supportChat.channel?.session_id) {
      this.logger.warn(`Execução ${execucao.id}: sem canal/contato para enviar efeitos`);
      return;
    }

    for (const effect of effects) {
      // A chamada ao provider ocorre fora da transação; alguém pode assumir
      // a conversa entre dois envios acumulados pelo mesmo passo do fluxo.
      const atual = await this.supportChatsService.findParaEnvioBot(execucao.support_chat_id);
      const permitido = execucao.phase === 'saida'
        ? [SupportChatStatusId.FINALIZADO, SupportChatStatusId.FINALIZADO_PELO_CHATBOT].includes(atual?.support_chat_status_id) && atual?.pos_atendimento_ativo
        : atual?.support_chat_status_id === SupportChatStatusId.EM_FILA && !atual.user_id;
      if (!permitido || atual.channel?.chatbot_habilitado === false) return;
      if (effect.type === 'send_text') {
        const enviadoEm = new Date();
        const enviada = await this.whatsappService.sendMessage(
          supportChat.channel.session_id,
          supportChat.contact.remote_jid,
          effect.text,
          effect.typingDelayMs,
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
              isAutomatic: true,
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

        // A Evolution precisa baixar/transformar imagens e áudios. Em alguns
        // ambientes ela não consegue concluir esse download externo, embora o
        // objeto do B2 esteja público. Para esses tipos do próprio fluxo,
        // entregamos os bytes diretamente. Vídeos/documentos permanecem por
        // URL, pois base64 deles pode deixar a requisição grande demais.
        const media =
          ehAnexoPermanente && ['image', 'audio', 'voice'].includes(effect.mediaType)
            ? (await this.storageService.getBuffer(mediaKeyParaEnvio)).toString('base64')
            : this.storageService.getPublicUrl(mediaKeyParaEnvio);
        const enviadoEm = new Date();
        const enviada = await this.whatsappService.sendMedia(supportChat.channel.session_id, {
          to: supportChat.contact.remote_jid,
          mediaType: effect.mediaType,
          media,
          mimetype: effect.mimetype,
          caption: effect.caption,
          fileName: effect.fileName,
          typingDelayMs: effect.typingDelayMs,
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
              isAutomatic: true,
            },
            manager,
          ),
        );
      }
    }
  }
}
