import { BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import axios, { AxiosInstance, isAxiosError } from 'axios';

import { MessageMedia } from '@types';
import { ResolvedIntegration } from 'integrations/integrations.service';
import {
  ProviderClientInfo,
  ProviderConnectionResult,
  ProviderConnectionStatus,
  ProviderMediaPayload,
  ProviderMediaType,
  ProviderSentMessage,
  ProviderMessageRef,
  ProviderSessionRef,
  ProviderTesteConexao,
  WhatsappProvider,
} from '../whatsapp-provider.interface';
import { EvolutionMapper } from './evolution.mapper';
import {
  EvolutionBase64Response,
  EvolutionConnectionStateResponse,
  EvolutionConnectResponse,
  EvolutionInstanceCreateResponse,
  EvolutionSendResponse,
} from './evolution.types';

/** Eventos que pedimos à Evolution - nomes em UPPER_SNAKE, como a config dela espera. */
/** Tamanho em bytes de um conteúdo base64, sem precisar decodificá-lo. */
function tamanhoDoBase64(base64: string): number {
  const limpo = base64.replace(/^data:[^,]+,/, '');
  const padding = limpo.endsWith('==') ? 2 : limpo.endsWith('=') ? 1 : 0;
  return Math.floor((limpo.length * 3) / 4) - padding;
}

const SUBSCRIBED_EVENTS = [
  'QRCODE_UPDATED',
  'CONNECTION_UPDATE',
  'MESSAGES_UPSERT',
  'MESSAGES_UPDATE',
  // Edição feita pelo contato.
  'MESSAGES_EDITED',
  // Edição feita por nós: a Evolution usa um evento distinto para a alteração
  // que parte da própria instância.
  'SEND_MESSAGE_UPDATE',
  'MESSAGES_DELETE',
  'SEND_MESSAGE',
  'CONTACTS_UPDATE',
  'CHATS_UPDATE',
];

/** Tipos internos de mídia → `mediatype` da Evolution. */
const MEDIA_TYPE_MAP: Record<ProviderMediaType, string> = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  // `voice` não passa por `sendMedia`: tem rota própria, que converte para
  // OGG/Opus e marca `ptt`. O valor aqui é só para o mapa ficar completo.
  voice: 'audio',
  document: 'document',
  sticker: 'image',
};

/**
 * Implementação do provider para a Evolution API v2.3.7 (Baileys).
 *
 * Cada instância é construída para uma integração específica: a URL base e a
 * apikey vêm do banco, não de variáveis de ambiente, porque podem coexistir
 * várias integrações.
 */
export class EvolutionProvider implements WhatsappProvider {
  readonly slug = 'evolution';

  private readonly logger = new Logger(EvolutionProvider.name);
  private readonly http: AxiosInstance;

  constructor(
    private readonly integration: ResolvedIntegration,
    private readonly webhookUrl: string,
  ) {
    if (!integration.base_url) {
      throw new BadRequestException(
        `A integração "${integration.name}" não tem base_url configurada.`,
      );
    }

    this.http = axios.create({
      baseURL: integration.base_url.replace(/\/+$/, ''),
      headers: {
        'Content-Type': 'application/json',
        // A Evolution autentica por um header `apikey` simples (não Bearer).
        // Este é o padrão: a chave **global**, necessária para criar, listar e
        // remover instâncias. As operações sobre uma instância específica o
        // sobrescrevem com o token dela — ver `comToken`.
        apikey: integration.credentials?.apiKey ?? '',
      },
      timeout: 30_000,
    });
  }

  /**
   * Config da requisição autenticada com o token **da instância**, quando ela
   * tem um.
   *
   * A Evolution emite um token por instância no `/instance/create` e o aceita
   * no lugar da chave global nas operações daquela instância — recusando-o
   * (401) para qualquer outra. Usá-lo limita o estrago de um vazamento a um
   * canal, em vez de entregar a chave que apaga todas as instâncias do
   * servidor. Num backend multi-tenant, é a diferença entre um cliente poder
   * derrubar só o próprio número ou o de todo mundo.
   *
   * O fallback para a global cobre dois casos reais: canais criados antes de
   * o token passar a ser gravado, e as rotas que **exigem** a global —
   * `/instance/create` e `/instance/fetchInstances` a recusam.
   */
  private comToken(session: ProviderSessionRef) {
    if (!session?.instanceToken) return undefined;

    return { headers: { apikey: session.instanceToken } };
  }

  async requestConnection(session: ProviderSessionRef): Promise<ProviderConnectionResult> {
    const state = await this.fetchConnectionState(session);

    // Instância ainda não existe na Evolution: cria já com o webhook configurado.
    if (state === null) {
      return this.createInstance(session);
    }

    if (state === 'open') {
      return { state: 'connected' };
    }

    return this.connectInstance(session);
  }

  async requestQrCode(session: ProviderSessionRef): Promise<string | null> {
    const result = await this.connectInstance(session);
    return result.qrCode ?? null;
  }

  async requestDisconnection(session: ProviderSessionRef): Promise<void> {
    try {
      await this.http.delete(`/instance/logout/${session.sessionId}`, this.comToken(session));
      this.logger.log(`Sessão encerrada: ${session.sessionId}`);
    } catch (error) {
      // Já desconectada ou inexistente: não é falha do ponto de vista do domínio.
      if (this.statusOf(error) === 404) {
        this.logger.warn(`Sessão ${session.sessionId} já não existe na Evolution.`);
        return;
      }
      this.fail('Falha ao encerrar a sessão do WhatsApp', error);
    }
  }

  /**
   * Confere endereço e apikey sem tocar em sessão nenhuma.
   *
   * `/instance/fetchInstances` serve porque exige a apikey **global** — a mesma
   * que criar instância exige — e responde 401 quando ela não confere. O
   * `catch` traduz cada falha para uma frase que diz o que corrigir: sem isso,
   * a tela mostraria `ECONNREFUSED` ou `Request failed with status code 401`.
   */
  async testarConexao(): Promise<ProviderTesteConexao> {
    try {
      const { data } = await this.http.get<unknown[]>('/instance/fetchInstances');
      const instancias = Array.isArray(data) ? data.length : 0;

      return {
        ok: true,
        mensagem:
          instancias > 0
            ? `Conexão estabelecida. ${instancias} ${instancias === 1 ? 'instância encontrada' : 'instâncias encontradas'}.`
            : 'Conexão estabelecida. Nenhuma instância criada ainda.',
        instancias,
      };
    } catch (error) {
      if (isAxiosError(error)) {
        const status = error.response?.status;

        if (status === 401 || status === 403) {
          return { ok: false, mensagem: 'A API Key foi recusada pelo servidor.' };
        }
        if (status === 404) {
          return {
            ok: false,
            mensagem: 'Endereço respondeu, mas não parece ser uma Evolution API.',
          };
        }
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
          return {
            ok: false,
            mensagem:
              'Não foi possível alcançar o endereço. Confira a URL e se o serviço está no ar.',
          };
        }
        if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
          return { ok: false, mensagem: 'O servidor não respondeu a tempo.' };
        }
        if (status) {
          return { ok: false, mensagem: `O servidor respondeu com erro ${status}.` };
        }
      }

      this.logger.warn(`Teste de conexão falhou: ${error?.message}`);
      return { ok: false, mensagem: 'Não foi possível validar a integração.' };
    }
  }

  async getClientInfo(session: ProviderSessionRef): Promise<ProviderClientInfo> {
    try {
      const { data } = await this.http.get<{ instance?: Record<string, unknown> }[]>(
        `/instance/fetchInstances`,
        { params: { instanceName: session.sessionId } },
      );

      const instances = Array.isArray(data) ? data : [data];
      const found = instances.find((item) => {
        const candidate = (item?.instance ?? item) as Record<string, unknown>;
        return (
          candidate?.name === session.sessionId || candidate?.instanceName === session.sessionId
        );
      });

      const instance = (found?.instance ?? found ?? {}) as Record<string, string>;

      return {
        phoneNumber: EvolutionMapper.extractPhoneFromWuid(
          instance.ownerJid ?? instance.owner ?? instance.wuid,
        ),
        pushName: instance.profileName ?? null,
        profilePicUrl: instance.profilePicUrl ?? null,
      };
    } catch (error) {
      this.fail('Falha ao obter informações da sessão do WhatsApp', error);
    }
  }

  async getProfilePicUrl(session: ProviderSessionRef, remoteJid: string): Promise<string> {
    const numero = this.toNumber(remoteJid);

    try {
      const { data } = await this.http.post<{ profilePictureUrl?: string }>(
        `/chat/fetchProfilePictureUrl/${session.sessionId}`,
        { number: numero },
        this.comToken(session),
      );
      const url = data?.profilePictureUrl ?? '';

      // Resposta 200 sem URL é indistinguível, no log, de um contato que
      // simplesmente não tem foto — e as duas coisas levam ao avatar genérico
      // na tela. Sem esta linha a única pista era o campo vazio no banco,
      // descoberto horas depois.
      if (!url) {
        this.logger.warn(
          `Foto de perfil vazia para ${numero} (instância ${session.sessionId}); ` +
            `resposta: ${JSON.stringify(data)}`,
        );
      }

      return url;
    } catch (error) {
      // Contato sem foto ou com privacidade restrita é caso normal.
      this.logger.warn(
        `Não foi possível obter a foto de perfil de ${numero}: ${this.messageOf(error)}`,
      );
      return '';
    }
  }

  async getFormattedNumber(_session: ProviderSessionRef, remoteJid: string): Promise<string> {
    // O JID já carrega o número; não é preciso ir à rede.
    return this.toNumber(remoteJid);
  }

  async downloadMedia(
    session: ProviderSessionRef,
    messageId: string,
    chatId: string,
  ): Promise<MessageMedia> {
    try {
      const { data } = await this.http.post<EvolutionBase64Response>(
        `/chat/getBase64FromMediaMessage/${session.sessionId}`,
        {
          // Só a key basta: a Evolution completa a mensagem a partir do banco dela.
          message: { key: { id: messageId, remoteJid: chatId } },
        },
        this.comToken(session),
      );

      if (!data?.base64) {
        throw new InternalServerErrorException('A Evolution não retornou o conteúdo da mídia.');
      }

      return {
        mimetype: data.mimetype ?? 'application/octet-stream',
        data: data.base64,
        filename: data.fileName ?? null,
        // A Evolution nem sempre preenche `size.fileLength`; quando falta, o
        // tamanho sai do próprio base64 (3 bytes a cada 4 caracteres, menos o
        // padding). Sem isso a bolha exibiria "0 B".
        filesize: Number(data.size?.fileLength ?? 0) || tamanhoDoBase64(data.base64),
      };
    } catch (error) {
      this.fail('Falha ao baixar a mídia da mensagem', error);
    }
  }

  async sendMessage(
    session: ProviderSessionRef,
    to: string,
    message: string,
  ): Promise<ProviderSentMessage> {
    try {
      const { data } = await this.http.post<EvolutionSendResponse>(
        `/message/sendText/${session.sessionId}`,
        { number: this.toNumber(to), text: message },
        this.comToken(session),
      );
      return this.toSentMessage(data);
    } catch (error) {
      this.fail('Não foi possível enviar a mensagem', error);
    }
  }

  async replyMessage(
    session: ProviderSessionRef,
    chatId: string,
    messageId: string,
    message: string,
  ): Promise<ProviderSentMessage> {
    try {
      const { data } = await this.http.post<EvolutionSendResponse>(
        `/message/sendText/${session.sessionId}`,
        {
          number: this.toNumber(chatId),
          text: message,
          // Informando só a key.id, a Evolution recupera a mensagem citada.
          quoted: { key: { id: messageId } },
        },
        this.comToken(session),
      );
      return this.toSentMessage(data);
    } catch (error) {
      this.fail('Não foi possível responder a mensagem', error);
    }
  }

  async sendReaction(
    session: ProviderSessionRef,
    chatId: string,
    messageId: string,
    reaction: string,
    fromMe: boolean,
  ): Promise<void> {
    try {
      // sendReaction não usa `number`: o destino sai do próprio key.remoteJid.
      // O `fromMe` compõe a chave que identifica a mensagem reagida — fixá-lo
      // em `false` fazia a Evolution não achar as nossas próprias mensagens, e
      // a reação era aceita sem nunca aparecer no WhatsApp.
      await this.http.post(
        `/message/sendReaction/${session.sessionId}`,
        {
          key: { id: messageId, remoteJid: this.toJid(chatId), fromMe },
          reaction,
        },
        this.comToken(session),
      );
    } catch (error) {
      if (this.statusOf(error) === 400) {
        throw new BadRequestException('Mensagem não encontrada para adicionar reação.');
      }
      this.fail('Não foi possível enviar a reação', error);
    }
  }

  async editMessage(
    session: ProviderSessionRef,
    chatId: string,
    messageId: string,
    texto: string,
  ): Promise<void> {
    const jid = this.toJid(chatId);

    try {
      await this.http.post(
        `/chat/updateMessage/${session.sessionId}`,
        {
          number: this.toNumber(chatId),
          key: { id: messageId, remoteJid: jid, fromMe: true },
          text: texto,
        },
        this.comToken(session),
      );

      this.logger.log(`Mensagem ${messageId} editada`);
    } catch (error) {
      const mensagem = this.messageOf(error);
      this.logger.error(`Não foi possível editar a mensagem: ${mensagem}`);

      throw new BadRequestException(
        // A janela de 15 minutos é a recusa mais provável, e a mensagem crua da
        // Evolution não explica isso a quem está na tela.
        this.statusOf(error) === 400
          ? 'Não foi possível editar: o WhatsApp permite alterar a mensagem apenas nos primeiros 15 minutos.'
          : `Não foi possível editar a mensagem: ${mensagem}`,
      );
    }
  }

  async markAsRead(session: ProviderSessionRef, mensagens: ProviderMessageRef[]): Promise<void> {
    if (!mensagens.length) return;

    try {
      await this.http.post(
        `/chat/markMessageAsRead/${session.sessionId}`,
        {
          readMessages: mensagens.map(({ messageId, chatId, fromMe }) => ({
            id: messageId,
            remoteJid: this.toJid(chatId),
            fromMe,
          })),
        },
        this.comToken(session),
      );

      this.logger.log(`${mensagens.length} mensagem(ns) marcada(s) como lida(s)`);
    } catch (error) {
      // Não propaga: o "visto" é cortesia para o contato, e falhar aqui não
      // pode derrubar o envio da resposta, que é o que importa.
      this.logger.warn(`Não foi possível marcar como lida: ${this.messageOf(error)}`);
    }
  }

  async deleteMessage(
    session: ProviderSessionRef,
    chatId: string,
    messageId: string,
    fromMe: boolean,
  ): Promise<void> {
    try {
      // A Evolution recebe a chave no corpo de um DELETE - não em query string.
      await this.http.delete(`/chat/deleteMessageForEveryone/${session.sessionId}`, {
        data: { id: messageId, remoteJid: this.toJid(chatId), fromMe },
        ...this.comToken(session),
      });
    } catch (error) {
      if (this.statusOf(error) === 400) {
        throw new BadRequestException(
          'Não foi possível apagar: a mensagem pode ser antiga demais ou já ter sido removida.',
        );
      }
      this.fail('Não foi possível apagar a mensagem', error);
    }
  }

  async sendMedia(
    session: ProviderSessionRef,
    payload: ProviderMediaPayload,
  ): Promise<ProviderSentMessage> {
    const { to, mediaType, media, mimetype, caption, fileName, quotedMessageId } = payload;

    // Vídeo/áudio/documento são aceitos por URL: a Evolution repassa ao Baileys,
    // que baixa direto - sem trafegar bytes por aqui nem passar por browser.
    const body: Record<string, unknown> = {
      number: this.toNumber(to),
      mediatype: MEDIA_TYPE_MAP[mediaType],
      media,
      ...(mimetype && { mimetype }),
      ...(caption && { caption }),
      ...(fileName && { fileName }),
      ...(quotedMessageId && { quoted: { key: { id: quotedMessageId } } }),
    };

    // Documento sem nome de arquivo é rejeitado quando a mídia vem em base64.
    if (mediaType === 'document' && !fileName) {
      body.fileName = 'documento';
    }

    const endpoint =
      mediaType === 'sticker'
        ? `/message/sendSticker/${session.sessionId}`
        : mediaType === 'voice'
          ? `/message/sendWhatsAppAudio/${session.sessionId}`
          : `/message/sendMedia/${session.sessionId}`;

    if (mediaType === 'sticker') {
      delete body.mediatype;
      body.sticker = media;
      delete body.media;
    }

    // A rota de mensagem de voz tem corpo próprio: só `audio`, sem `mediatype`
    // nem `caption` (o WhatsApp não exibe legenda em bolha de voz). A Evolution
    // baixa a URL e converte para OGG/Opus com ffmpeg antes de enviar.
    if (mediaType === 'voice') {
      body.audio = media;
      delete body.media;
      delete body.mediatype;
      delete body.caption;
      delete body.fileName;
      delete body.mimetype;
    }

    // O provider baixa a mídia da URL que enviamos, e esse download pode falhar
    // por instabilidade de rede até o storage - sem timeout configurável do lado
    // dele. Uma nova tentativa costuma resolver, então vale insistir antes de
    // devolver erro ao atendente.
    const tentativas = 3;
    for (let tentativa = 1; tentativa <= tentativas; tentativa++) {
      try {
        const { data } = await this.http.post<EvolutionSendResponse>(
          endpoint,
          body,
          this.comToken(session),
        );
        this.logger.log(`Mídia (${mediaType}) enviada para ${to}`);
        return this.toSentMessage(data);
      } catch (error) {
        const ultima = tentativa === tentativas;
        if (ultima || !this.isFalhaTransitoriaDeMidia(error)) {
          this.fail('Não foi possível enviar a mídia', error);
        }

        this.logger.warn(
          `Falha ao enviar mídia (tentativa ${tentativa}/${tentativas}): ${this.messageOf(error)}. Tentando novamente...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 2000 * tentativa));
      }
    }

    // Inalcançável: o laço acima sempre retorna ou lança.
    throw new InternalServerErrorException('Não foi possível enviar a mídia');
  }

  /**
   * Distingue falha de rede ao buscar a mídia (vale repetir) de erro de
   * validação como tipo inválido ou número inexistente (repetir não ajuda).
   */
  private isFalhaTransitoriaDeMidia(error: unknown): boolean {
    const status = this.statusOf(error);
    if (status && status < 500) return false;

    const detalhe = this.messageOf(error).toLowerCase();
    return (
      detalhe.includes('fetch failed') ||
      detalhe.includes('etimedout') ||
      detalhe.includes('econnreset') ||
      detalhe.includes('socket hang up') ||
      detalhe.includes('network') ||
      status === undefined
    );
  }

  // == Internos ==

  /** Estado atual da instância, ou null quando ela não existe na Evolution. */
  /**
   * Estado da sessão consultado na hora, para reconciliar com o nosso banco.
   *
   * A Evolution devolve o vocabulário do Baileys (`open`/`connecting`/`close`);
   * aqui ele vira o do domínio.
   */
  async fetchConnectionStatus(
    session: ProviderSessionRef,
  ): Promise<ProviderConnectionStatus | null> {
    const estado = await this.fetchConnectionState(session);

    // Instância inexistente no provider: não é o mesmo que desconectada, e
    // quem chama precisa poder distinguir para recriá-la.
    if (estado === null) return null;

    if (estado === 'open') return 'connected';
    if (estado === 'connecting') return 'connecting';
    return 'disconnected';
  }

  /**
   * Estado da instância. Recebe a sessão inteira, não só o nome, para poder
   * autenticar com o token dela em vez da chave global.
   */
  private async fetchConnectionState(session: ProviderSessionRef): Promise<string | null> {
    try {
      const { data } = await this.http.get<EvolutionConnectionStateResponse>(
        `/instance/connectionState/${session.sessionId}`,
        this.comToken(session),
      );
      return data?.instance?.state ?? 'close';
    } catch (error) {
      // O guard de existência da Evolution responde 404 antes da autenticação.
      if (this.statusOf(error) === 404) return null;
      this.fail('Falha ao consultar o estado da sessão do WhatsApp', error);
    }
  }

  private async createInstance(session: ProviderSessionRef): Promise<ProviderConnectionResult> {
    try {
      const { data } = await this.http.post<EvolutionInstanceCreateResponse>('/instance/create', {
        instanceName: session.sessionId,
        qrcode: true,
        integration: 'WHATSAPP-BAILEYS',
        webhook: {
          enabled: true,
          url: this.webhookUrl,
          byEvents: false,
          base64: false,
          events: SUBSCRIBED_EVENTS,
          // Segredo próprio: o campo `apikey` do corpo do webhook vem nulo por padrão.
          headers: {
            'Content-Type': 'application/json',
            'x-webhook-secret': this.integration.webhook_secret ?? '',
          },
        },
      });

      this.logger.log(`Instância criada na Evolution: ${session.sessionId}`);

      return {
        state: 'connecting',
        qrCode: data?.qrcode?.code ?? null,
        instanceToken: data?.hash ?? null,
      };
    } catch (error) {
      // 403 = nome já existe; nesse caso basta conectar.
      if (this.statusOf(error) === 403) {
        this.logger.warn(`Instância ${session.sessionId} já existe; conectando.`);
        return this.connectInstance(session);
      }
      this.fail('Falha ao criar a instância do WhatsApp', error);
    }
  }

  /**
   * Conecta e normaliza o retorno, que é polimórfico: pode trazer o estado, o
   * objeto de QR cru, ou um erro - sempre com HTTP 200.
   */
  private async connectInstance(session: ProviderSessionRef): Promise<ProviderConnectionResult> {
    try {
      const { data } = await this.http.get<EvolutionConnectResponse>(
        `/instance/connect/${session.sessionId}`,
        this.comToken(session),
      );

      if (data?.error) {
        const detail = Array.isArray(data.message) ? data.message.join('; ') : data.message;
        throw new InternalServerErrorException(
          `Falha ao conectar a sessão do WhatsApp: ${detail ?? 'erro não informado'}`,
        );
      }

      const state = data?.instance?.state;
      if (state === 'open') {
        return { state: 'connected' };
      }

      const qrCode = data?.code ?? data?.qrcode?.code ?? null;
      return { state: 'connecting', qrCode };
    } catch (error) {
      this.fail('Falha ao conectar a sessão do WhatsApp', error);
    }
  }

  private toSentMessage(data: EvolutionSendResponse): ProviderSentMessage {
    return {
      messageId: data?.key?.id ?? '',
      timestamp: Number(data?.messageTimestamp) || undefined,
    };
  }

  /** Extrai apenas os dígitos do JID - é o formato que o campo `number` espera. */
  private toNumber(jidOrNumber: string): string {
    return (jidOrNumber ?? '').split('@')[0].replace(/\D/g, '');
  }

  /** Garante o sufixo de JID individual quando recebe só o número. */
  private toJid(jidOrNumber: string): string {
    if (!jidOrNumber) return '';
    return jidOrNumber.includes('@') ? jidOrNumber : `${this.toNumber(jidOrNumber)}@s.whatsapp.net`;
  }

  private statusOf(error: unknown): number | undefined {
    return isAxiosError(error) ? error.response?.status : undefined;
  }

  private messageOf(error: unknown): string {
    if (isAxiosError(error)) {
      const payload = error.response?.data;
      if (payload) {
        const detail =
          (payload as { response?: { message?: unknown } }).response?.message ??
          (payload as { message?: unknown }).message ??
          (payload as { error?: unknown }).error;
        if (detail) return Array.isArray(detail) ? detail.join('; ') : String(detail);
      }
      return error.message;
    }
    return error instanceof Error ? error.message : String(error);
  }

  private fail(context: string, error: unknown): never {
    // Erros já traduzidos para o domínio sobem intactos.
    if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
      throw error;
    }
    const detail = this.messageOf(error);
    this.logger.error(`${context}: ${detail}`);
    throw new InternalServerErrorException(`${context}: ${detail}`);
  }
}
