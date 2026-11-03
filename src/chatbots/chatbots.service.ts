import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';

import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, IsNull } from 'typeorm';

import { runInTransaction } from '@/Utils';
import { PresignedUpload, StorageService } from '@/storage/storage.service';
import { ChatbotFlowVersionsRepository, GRAFO_VAZIO } from './chatbot-flow-versions.repository';
import { ChatbotsRepository } from './chatbots.repository';
import { AssinarMediaDto } from './dto/assinar-media.dto';
import { CreateChatbotDto } from './dto/create-chatbot.dto';
import { SaveFlowDto } from './dto/save-flow.dto';
import { UpdateChatbotDto } from './dto/update-chatbot.dto';
import { ChatbotFlowVersions } from './entities/chatbot-flow-versions.entity';
import { Chatbots } from './entities/chatbots.entity';
import { validarTemposDeResposta } from './tempo-resposta';
import { validarFluxoSaida } from './validar-fluxo-saida';
import { validarTentativasMenu } from './tentativas-menu';
import { validarInicioFixo } from './inicio-fixo';
import { lerDestinoEncaminhamento, validarDestinoEncaminhamento } from './encaminhamento-atendimento';

/**
 * Onde os anexos do nó Mensagem vivem - permanentes, presos ao cadastro do
 * fluxo, nunca a uma conversa. Fora do alcance do cron de retenção
 * (`MediaRetentionService`), que varre por mensagem enviada, não por pasta;
 * é por isso que o envio de fato nunca usa esta key direto, e sim uma cópia
 * descartável (ver `ExecutionEngine.dispararEfeitos`).
 */
const PREFIXO_ANEXO = 'sistema/chatbot';

@Injectable()
export class ChatbotsService {
  private readonly logger = new Logger(ChatbotsService.name);

  constructor(
    private readonly chatbotsRepository: ChatbotsRepository,
    private readonly chatbotFlowVersionsRepository: ChatbotFlowVersionsRepository,
    private readonly storageService: StorageService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<Chatbots[]> {
    return this.comEstadoPublicacao(await this.chatbotsRepository.findAllActive());
  }

  async findAllComplementares(): Promise<Chatbots[]> {
    return this.comEstadoPublicacao(await this.chatbotsRepository.findAllComplementares());
  }

  private async comEstadoPublicacao(chatbots: Chatbots[], manager?: EntityManager) {
    const alterados = new Set(await this.chatbotsRepository.idsComAlteracoesNaoPublicadas(chatbots.map(c => c.id), manager));
    return chatbots.map(chatbot => ({ ...chatbot, has_unpublished_changes: alterados.has(Number(chatbot.id)) }));
  }

  /** Serializa salvar/publicar/despublicar sem alterar versões em execução. */
  private async bloquearChatbot(id: number, manager: EntityManager): Promise<Chatbots> {
    const chatbot = await manager.findOne(Chatbots, {
      where: { id, deleted_at: IsNull() }, lock: { mode: 'pessimistic_write' },
    });
    if (!chatbot) throw new NotFoundException('Chatbot não encontrado');
    return chatbot;
  }

  /** Opções do editor sem expor cadastro completo ou e-mail dos atendentes. */
  async destinosAtendimento() {
    const [setores, atendentes] = await Promise.all([
      this.dataSource.query('SELECT id, name FROM departments WHERE deleted_at IS NULL ORDER BY name'),
      this.dataSource.query(`SELECT u.id, u.name, u.last_name, ud.department_id FROM users u
        JOIN user_x_department ud ON ud.user_id = u.id JOIN departments d ON d.id = ud.department_id
        WHERE u.status = 1 AND d.deleted_at IS NULL ORDER BY u.name, u.last_name`),
    ]);
    return { setores, atendentes };
  }

  async findOne(id: number): Promise<Chatbots> {
    const chatbot = await this.chatbotsRepository.findById(id);
    return (await this.comEstadoPublicacao([chatbot]))[0];
  }

  async create(dto: CreateChatbotDto): Promise<Chatbots> {
    const name = dto.name.trim();

    if (await this.chatbotsRepository.nomeEmUso(name)) {
      throw new ConflictException(`Já existe um chatbot chamado "${name}"`);
    }

    return runInTransaction(this.dataSource, async (manager) => {
      const salvo = await manager.save(Chatbots, { name, type: dto.type });

      // O rascunho nasce junto, com só o nó Início - a tela de edição sempre
      // encontra algo para carregar, sem precisar de um caso especial de
      // "chatbot sem fluxo ainda".
      await manager.save(ChatbotFlowVersions, {
        chatbot_id: salvo.id,
        status: 'draft',
        graph: GRAFO_VAZIO,
        version_number: 0,
      });

      this.logger.log(`Chatbot criado: ${salvo.name} (id ${salvo.id}, tipo ${salvo.type})`);

      return salvo;
    });
  }

  async update(id: number, dto: UpdateChatbotDto): Promise<Chatbots> {
    const chatbot = await this.chatbotsRepository.findById(id);
    const name = dto.name?.trim();

    if (name && (await this.chatbotsRepository.nomeEmUso(name, id))) {
      throw new ConflictException(`Já existe um chatbot chamado "${name}"`);
    }

    const type = dto.type ?? chatbot.type;
    if (type !== chatbot.type) throw new BadRequestException('O tipo de um chatbot já criado não pode ser alterado');
    const active = dto.active ?? chatbot.active;
    const channelIds = await this.chatbotsRepository.findCanaisDoChatbot(id);

    if (active) {
      await this.assertSemConflitoNosCanais(channelIds, type, id);
    }

    return runInTransaction(this.dataSource, async (manager) => {
      // Não regrava o ponteiro de publicação lido antes da transação:
      // uma publicação simultânea não pode ser desfeita ao editar o nome.
      const alteracoes = {
        ...(name && { name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.settings !== undefined && { settings: dto.settings }),
      };
      if (Object.keys(alteracoes).length) await manager.update(Chatbots, id, alteracoes);

      this.logger.log(`Chatbot atualizado: id ${id}`);

      return manager.findOne(Chatbots, { where: { id } });
    });
  }

  /**
   * Nenhum dos canais da lista pode já ter outro chatbot ativo do mesmo tipo
   * - a trava que antes era constraint de banco (`uq_chatbots_channel_type_
   * active`) e virou validação de aplicação com o M:N (ver `entities/
   * chatbots.entity.ts`).
   */
  private async assertSemConflitoNosCanais(
    channelIds: number[],
    type: Chatbots['type'],
    ignorarId?: number,
  ): Promise<void> {
    if (type === 'complementar') return;

    for (const channelId of channelIds) {
      if (await this.chatbotsRepository.ativoNoCanal(channelId, type, ignorarId)) {
        throw new BadRequestException(
          `Este canal já tem um chatbot de ${type} ativo. Desative-o antes de ativar outro.`,
        );
      }
    }
  }

  async remove(id: number): Promise<{ status: string }> {
    const chatbot = await this.chatbotsRepository.findById(id);

    await runInTransaction(this.dataSource, async (manager) => {
      await manager.update(Chatbots, id, { deleted_at: new Date() });
    });

    this.logger.log(`Chatbot removido: ${chatbot.name} (id ${id})`);

    return { status: 'chatbot removed' };
  }

  /** O rascunho vigente do fluxo - todo chatbot sempre tem um, criado no `create`. */
  async findDraft(chatbotId: number): Promise<ChatbotFlowVersions> {
    await this.chatbotsRepository.findById(chatbotId); // 404 se o chatbot não existir

    const draft = await this.chatbotFlowVersionsRepository.findDraft(chatbotId);
    if (!draft) throw new NotFoundException('Rascunho do fluxo não encontrado');
    const alterados = await this.chatbotsRepository.idsComAlteracoesNaoPublicadas([chatbotId]);
    return { ...draft, has_unpublished_changes: alterados.includes(Number(chatbotId)) } as ChatbotFlowVersions;
  }

  /**
   * URL assinada para o anexo de um nó Mensagem.
   *
   * ⚠️ O prefixo é fixo aqui, não vem do corpo - mesmo padrão de
   * `QuickRepliesService.assinarAnexo`, e pela mesma razão: um endpoint que
   * aceitasse o caminho de quem chama deixaria qualquer autenticado escrever
   * onde quiser no bucket.
   */
  async assinarMedia(dto: AssinarMediaDto): Promise<PresignedUpload> {
    const extensao = extname(dto.fileName) || '';
    const key = `${PREFIXO_ANEXO}/${randomUUID()}${extensao}`;

    return this.storageService.createPresignedPost(key, dto.fileType);
  }

  /** Substitui o grafo do rascunho inteiro - não há edição parcial de nó. */
  async saveFlow(chatbotId: number, dto: SaveFlowDto): Promise<ChatbotFlowVersions> {
    return runInTransaction(this.dataSource, async (manager) => {
      await this.bloquearChatbot(chatbotId, manager);
      const draft = await this.chatbotFlowVersionsRepository.findDraft(chatbotId, manager);
      if (!draft) throw new NotFoundException('Rascunho do fluxo não encontrado');

      validarInicioFixo(dto, draft.graph);
      await manager.update(ChatbotFlowVersions, draft.id, {
        graph: { nodes: dto.nodes, edges: dto.edges, viewport: dto.viewport },
      });

      this.logger.log(`Fluxo salvo: chatbot ${chatbotId}, draft ${draft.id}`);

      const salvo = await manager.findOne(ChatbotFlowVersions, { where: { id: draft.id } });
      const alterados = await this.chatbotsRepository.idsComAlteracoesNaoPublicadas([chatbotId], manager);
      return { ...salvo, has_unpublished_changes: alterados.includes(Number(chatbotId)) } as ChatbotFlowVersions;
    });
  }

  /**
   * Congela o draft atual numa nova versão `published` e aponta
   * `Chatbots.current_published_version_id` para ela - é só a partir daqui
   * que o motor de execução (`findEntradaAtivoDoCanal`) passa a enxergar o
   * fluxo. O draft continua editável enquanto a publicação anterior atende.
   * Execuções existentes mantêm a versão que já carregaram.
   */
  async publish(chatbotId: number): Promise<Chatbots> {
    return runInTransaction(this.dataSource, async (manager) => {
      const chatbot = await this.bloquearChatbot(chatbotId, manager);
      const draft = await this.chatbotFlowVersionsRepository.findDraft(chatbotId, manager);

      if (!draft) {
        throw new NotFoundException('Rascunho do fluxo não encontrado');
      }

      validarInicioFixo(draft.graph);
      validarTemposDeResposta(draft.graph);
      validarTentativasMenu(draft.graph);
      if (chatbot.type === 'saida') validarFluxoSaida(draft.graph);

      for (const no of draft.graph.nodes.filter(no => no.type === 'handoff')) {
        if (draft.graph.edges.some(edge => edge.source === no.id)) {
          throw new BadRequestException('O nó Encaminhar para atendimento termina o chatbot e não pode ter ligações de saída');
        }
        await validarDestinoEncaminhamento(manager, lerDestinoEncaminhamento(no.data));
      }

      for (const no of draft.graph.nodes.filter((no) => ['set_department', 'business_hours', 'handoff'].includes(no.type))) {
        const setorId = Number(no.data.department_id);
        if (!Number.isSafeInteger(setorId) || setorId <= 0) throw new BadRequestException('Escolha o setor em todos os nós de definição de setor ou verificação de horário');
        const [setor] = await manager.query('SELECT id FROM departments WHERE id = $1 AND deleted_at IS NULL', [setorId]);
        if (!setor) throw new BadRequestException('Um nó de setor ou horário aponta para um setor removido');
        const invalidos = await manager.query(`SELECT c.name FROM channels c JOIN channel_x_chatbot cc ON cc.channel_id = c.id
          WHERE cc.chatbot_id = $1 AND NOT EXISTS (SELECT 1 FROM channel_x_department cd WHERE cd.channel_id = c.id AND cd.department_id = $2)`, [chatbotId, setorId]);
        if (invalidos.length) throw new BadRequestException(`O setor do fluxo precisa estar vinculado aos canais: ${invalidos.map((c: { name: string }) => c.name).join(', ')}`);
      }
      const vigente = chatbot.current_published_version_id
        ? await this.chatbotFlowVersionsRepository.findById(chatbot.current_published_version_id, manager) : null;
      if (vigente && isDeepStrictEqual(vigente.graph, draft.graph)) {
        return { ...chatbot, has_unpublished_changes: false };
      }
      const publicada = await this.chatbotFlowVersionsRepository.publicarDraft(draft, manager);

      await manager.update(Chatbots, chatbotId, { current_published_version_id: publicada.id });

      this.logger.log(
        `Fluxo publicado: chatbot ${chatbotId}, versão ${publicada.version_number} (id ${publicada.id})`,
      );

      return { ...await manager.findOne(Chatbots, { where: { id: chatbotId } }), has_unpublished_changes: false };
    });
  }

  /**
   * Retira o fluxo de produção sem apagar seu histórico de versões e sem
   * mudar `active`. Execuções já iniciadas conservam a versão gravada nelas;
   * apenas novas conversas deixam de acionar este chatbot até publicar outra
   * versão.
   */
  async unpublish(chatbotId: number): Promise<Chatbots> {
    return runInTransaction(this.dataSource, async (manager) => {
      const chatbot = await this.bloquearChatbot(chatbotId, manager);
      if (!chatbot.current_published_version_id) return { ...chatbot, has_unpublished_changes: false };
      await manager.update(Chatbots, chatbotId, { current_published_version_id: null });

      this.logger.log(`Fluxo despublicado: chatbot ${chatbotId}`);

      return { ...await manager.findOne(Chatbots, { where: { id: chatbotId } }), has_unpublished_changes: false };
    });
  }
}
