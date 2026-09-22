import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';

import { runInTransaction } from '@/Utils';
import { PresignedUpload, StorageService } from '@/storage/storage.service';
import { AssinarAnexoDto } from './dto/assinar-anexo.dto';
import { CreateQuickReplyDto } from './dto/create-quick-reply.dto';
import { UpdateQuickReplyDto } from './dto/update-quick-reply.dto';
import { QuickReplies } from './entities/quick-replies.entity';
import { QuickRepliesRepository } from './quick-replies.repository';

/** Onde os anexos do cadastro vivem. O cron de retenção não varre este prefixo. */
const PREFIXO_ANEXO = 'quick-replies';

@Injectable()
export class QuickRepliesService {
  private readonly logger = new Logger(QuickRepliesService.name);

  constructor(
    private readonly quickRepliesRepository: QuickRepliesRepository,
    private readonly storageService: StorageService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<QuickReplies[]> {
    const respostas = await this.quickRepliesRepository.findAllActive();

    return respostas.map((r) => this.comUrlDoAnexo(r));
  }

  async findOne(id: number): Promise<QuickReplies> {
    return this.comUrlDoAnexo(await this.quickRepliesRepository.findById(id));
  }

  async create(dto: CreateQuickReplyDto): Promise<QuickReplies> {
    const atalho = this.normalizaAtalho(dto.atalho);

    if (await this.quickRepliesRepository.atalhoEmUso(atalho)) {
      throw new ConflictException(`Já existe uma resposta rápida com o atalho "${atalho}"`);
    }

    return runInTransaction(this.dataSource, async (manager) => {
      const resposta = this.quickRepliesRepository.create({ ...dto, atalho });
      const salva = await manager.save(QuickReplies, resposta);

      this.logger.log(`Resposta rápida criada: /${salva.atalho} (id ${salva.id})`);

      return this.comUrlDoAnexo(salva);
    });
  }

  async update(id: number, dto: UpdateQuickReplyDto): Promise<QuickReplies> {
    const atual = await this.quickRepliesRepository.findById(id);
    const atalho = dto.atalho ? this.normalizaAtalho(dto.atalho) : atual.atalho;

    if (dto.atalho && (await this.quickRepliesRepository.atalhoEmUso(atalho, id))) {
      throw new ConflictException(`Já existe uma resposta rápida com o atalho "${atalho}"`);
    }

    // O anexo antigo sai do storage quando é trocado ou removido: sem isto o
    // bucket acumularia arquivos que nada mais referencia.
    const trocouAnexo = dto.anexo_key !== undefined && dto.anexo_key !== atual.anexo_key;
    if (trocouAnexo && atual.anexo_key) {
      await this.removeAnexo(atual.anexo_key);
    }

    return runInTransaction(this.dataSource, async (manager) => {
      await manager.update(QuickReplies, id, { ...dto, atalho });
      const atualizada = await this.quickRepliesRepository.findById(id);

      this.logger.log(`Resposta rápida atualizada: /${atualizada.atalho} (id ${id})`);

      return this.comUrlDoAnexo(atualizada);
    });
  }

  async remove(id: number): Promise<{ removida: boolean }> {
    const resposta = await this.quickRepliesRepository.findById(id);

    // Soft delete, como em `tags`: o atalho volta a ficar livre (o índice único
    // é parcial) e o registro fica para auditoria.
    await runInTransaction(this.dataSource, (manager) =>
      manager.update(QuickReplies, id, { deleted_at: new Date() }),
    );

    if (resposta.anexo_key) {
      await this.removeAnexo(resposta.anexo_key);
    }

    this.logger.log(`Resposta rápida removida: /${resposta.atalho} (id ${id})`);

    return { removida: true };
  }

  /**
   * URL assinada para subir o anexo.
   *
   * ⚠️ O prefixo é fixo aqui, não vem do corpo: o `sign-media-post` do chat
   * aceita o caminho de quem chama, o que deixa qualquer autenticado escrever
   * onde quiser no bucket.
   *
   * A extensão sai do **nome original**. Derivá-la do mimetype produz
   * `.vnd.openxmlformats-officedocument.wordprocessingml.document` num `.docx`
   * - tolerável na mídia de chat, onde o `file_name` carrega o nome de
   * verdade, mas aqui o arquivo fica com esse nome para sempre.
   */
  async assinarAnexo(dto: AssinarAnexoDto): Promise<PresignedUpload> {
    const extensao = extname(dto.fileName) || '';
    const key = `${PREFIXO_ANEXO}/${randomUUID()}${extensao}`;

    return this.storageService.createPresignedPost(key, dto.fileType);
  }

  /**
   * Uma cópia descartável do anexo, para ser enviada numa conversa.
   *
   * ⚠️ **É isto que protege o cadastro.** A mensagem enviada guarda a key da
   * mídia, e o cron de retenção apaga por essa key depois de alguns meses, sem
   * olhar prefixo (`media-retention.service.ts`). Se a mensagem apontasse para
   * o arquivo do cadastro, o primeiro envio o condenaria - e todas as respostas
   * que o usam quebrariam de uma vez, em silêncio.
   *
   * A cópia roda no servidor de storage: nada trafega pelo backend.
   */
  async copiaAnexoParaEnvio(id: number): Promise<{
    media_key: string;
    media_type: string;
    mimetype: string;
    file_name: string;
  }> {
    const resposta = await this.quickRepliesRepository.findById(id);

    if (!resposta.anexo_key) {
      throw new ConflictException('Esta resposta rápida não tem anexo');
    }

    const extensao = extname(resposta.anexo_nome ?? '') || extname(resposta.anexo_key) || '';
    const destino = `chat/media/${randomUUID()}${extensao}`;

    await this.storageService.copyObject(resposta.anexo_key, destino);

    return {
      media_key: destino,
      media_type: resposta.anexo_tipo,
      mimetype: resposta.anexo_mimetype,
      file_name: resposta.anexo_nome,
    };
  }

  /** Sem a barra e sem espaços: ela é o gatilho, não parte do nome. */
  private normalizaAtalho(atalho: string): string {
    return atalho.trim().replace(/^\/+/, '');
  }

  /**
   * A coluna guarda a key; a tela precisa da URL para mostrar o anexo.
   *
   * Muta e devolve o mesmo objeto - o padrão de `traduzAvatares`.
   */
  private comUrlDoAnexo(resposta: QuickReplies): QuickReplies {
    if (resposta?.anexo_key) {
      (resposta as QuickReplies & { anexo_url?: string }).anexo_url =
        this.storageService.getPublicUrl(resposta.anexo_key);
    }

    return resposta;
  }

  /** Falha ao apagar não derruba a operação: o cadastro já foi alterado. */
  private async removeAnexo(key: string): Promise<void> {
    try {
      await this.storageService.deleteObject(key);
    } catch (err) {
      this.logger.warn(`Não foi possível remover o anexo ${key}: ${err.message}`);
    }
  }
}
