import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

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
    return this.chatbotsRepository.findAllActive();
  }

  async findAllComplementares(): Promise<Chatbots[]> {
    return this.chatbotsRepository.findAllComplementares();
  }

  async findOne(id: number): Promise<Chatbots> {
    return this.chatbotsRepository.findById(id);
  }

  async create(dto: CreateChatbotDto): Promise<Chatbots> {
    const name = dto.name.trim();

    if (await this.chatbotsRepository.nomeEmUso(name)) {
      throw new ConflictException(`Já existe um chatbot chamado "${name}"`);
    }

    if (
      dto.type !== 'complementar' &&
      dto.channel_id &&
      (await this.chatbotsRepository.ativoNoCanal(dto.channel_id, dto.type))
    ) {
      throw new BadRequestException(
        `Este canal já tem um chatbot de ${dto.type} ativo. Desative-o antes de ativar outro.`,
      );
    }

    return runInTransaction(this.dataSource, async (manager) => {
      const salvo = await manager.save(Chatbots, {
        name,
        type: dto.type,
        channel_id: dto.type === 'complementar' ? null : dto.channel_id ?? null,
      });

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
    const channelId = dto.type === 'complementar' ? null : dto.channel_id ?? chatbot.channel_id;
    const active = dto.active ?? chatbot.active;

    if (
      type !== 'complementar' &&
      channelId &&
      active &&
      (await this.chatbotsRepository.ativoNoCanal(channelId, type, id))
    ) {
      throw new BadRequestException(
        `Este canal já tem um chatbot de ${type} ativo. Desative-o antes de ativar outro.`,
      );
    }

    return runInTransaction(this.dataSource, async (manager) => {
      await manager.save(Chatbots, {
        ...chatbot,
        ...(name && { name }),
        ...(dto.type !== undefined && { type: dto.type }),
        channel_id: channelId,
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.settings !== undefined && { settings: dto.settings }),
      });

      this.logger.log(`Chatbot atualizado: id ${id}`);

      return manager.findOne(Chatbots, { where: { id } });
    });
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

    return this.chatbotFlowVersionsRepository.findDraft(chatbotId);
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
    await this.chatbotsRepository.findById(chatbotId);

    return runInTransaction(this.dataSource, async (manager) => {
      const draft = await this.chatbotFlowVersionsRepository.findDraft(chatbotId, manager);

      await manager.update(ChatbotFlowVersions, draft.id, {
        graph: { nodes: dto.nodes, edges: dto.edges, viewport: dto.viewport },
      });

      this.logger.log(`Fluxo salvo: chatbot ${chatbotId}, draft ${draft.id}`);

      return manager.findOne(ChatbotFlowVersions, { where: { id: draft.id } });
    });
  }
}
