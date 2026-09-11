import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomUUID } from 'node:crypto';

import { ContactsService } from '@/contacts/contacts.service';
import { WhatsappService } from '@/whatsapp/whatsapp.service';
import {
  ChatPayload,
  MessageEditPayload,
  MessagePayload,
  MessageTypes,
  ReactionPayload,
  WhatsappWebhookPayload,
} from '@types';

import { Contacts } from '@/contacts/entities/contacts.entity';
import { runInTransaction } from '@/Utils';
import { SupportChats } from './entities/support-chats.entity';
import { MessagesService } from './messages/messages.service';
import { SupportChatsRepository } from './support-chats.repository';
import { PresignedUpload, StorageService } from '@/storage/storage.service';
import { ChannelsRepository } from '@/channels/channels.repository';
import { RedisCacheRepository } from '@/redis-cache/redis-cache.repository';
import { SignMediaPostDto } from './dto/sign-media-post.dto';
import { SendMediaDto, SendMediaType } from './dto/send-media.dto';

/** Tipo de mídia do envio → tipo interno persistido, o mesmo que o webhook grava. */
const TIPO_INTERNO_POR_MIDIA: Record<SendMediaType, MessageTypes> = {
  [SendMediaType.IMAGE]: MessageTypes.IMAGE,
  [SendMediaType.VIDEO]: MessageTypes.VIDEO,
  [SendMediaType.AUDIO]: MessageTypes.AUDIO,
  [SendMediaType.VOICE]: MessageTypes.VOICE,
  [SendMediaType.DOCUMENT]: MessageTypes.DOCUMENT,
  [SendMediaType.STICKER]: MessageTypes.STICKER,
};

@Injectable()
export class SupportChatsService {
  private readonly logger = new Logger(SupportChatsService.name);

  constructor(
    private readonly redisCacheRepository: RedisCacheRepository,
    private readonly whatsappService: WhatsappService,
    private readonly messagesService: MessagesService,
    private readonly channelsRepository: ChannelsRepository,
    private readonly contactsService: ContactsService,
    private readonly supportChatsRepository: SupportChatsRepository,
    private readonly storageService: StorageService,
    private readonly dataSource: DataSource,
  ) {}

  async sendMessage(id: number, chat_id: string, message: string) {
    this.logger.log(`Enviando mensagem de para ${chat_id} com mensagem: ${message}`);

    const supportChat = await this.supportChatsRepository.findOne({
      where: { id },
      relations: ['channel'],
    });
    if (!supportChat) {
      throw new NotFoundException('Chat de suporte não encontrado');
    }

    const enviadoEm = new Date();
    const sentMessage = await this.whatsappService.sendMessage(
      supportChat.channel.session_id,
      chat_id,
      message,
    );
    this.redisCacheRepository.set(
      `mediaMessage:messageId:${sentMessage.messageId}`,
      JSON.stringify(sentMessage),
      30,
    );

    await this.registraEnvio({
      messageId: sentMessage.messageId,
      supportChat,
      to: chat_id,
      content: message,
      type: MessageTypes.TEXT,
      sentAt: enviadoEm,
    });

    // O id volta para o front casar a mensagem otimista (exibida na hora) com a
    // definitiva, que chega depois pelo webhook.
    return { status: 'message sent', message_id: sentMessage.messageId };
  }

  async replyMessage(id: number, chat_id: string, messageId: string, message: string) {
    this.logger.log(`Enviando mensagem de para ${chat_id} com mensagem: ${message}`);
    const supportChat = await this.supportChatsRepository.findOne({
      where: { id },
      relations: ['channel'],
    });
    if (!supportChat) {
      throw new NotFoundException('Chat de suporte não encontrado');
    }

    const enviadoEm = new Date();
    const sentMessage = await this.whatsappService.replyMessage(
      supportChat.channel.session_id,
      chat_id,
      messageId,
      message,
    );
    this.redisCacheRepository.set(
      `mediaMessage:messageId:${sentMessage.messageId}`,
      JSON.stringify(sentMessage),
      30,
    );

    await this.registraEnvio({
      messageId: sentMessage.messageId,
      supportChat,
      to: chat_id,
      content: message,
      type: MessageTypes.TEXT,
      quotedMsgId: messageId,
      sentAt: enviadoEm,
    });

    return { status: 'message sent', message_id: sentMessage.messageId };
  }

  /**
   * Envia mídia para a conversa.
   *
   * O arquivo já está no storage (subido pelo front via URL assinada); daqui só
   * segue a URL pública, que o provider usa para baixar. É o que permite enviar
   * vídeos grandes: nada de base64 no corpo nem browser headless no caminho.
   */
  async sendMedia(id: number, sendMediaDto: SendMediaDto) {
    const { chat_id, media_key, media_type, mimetype, caption, file_name, quoted_message_id } =
      sendMediaDto;

    const supportChat = await this.supportChatsRepository.findOne({
      where: { id },
      relations: ['channel'],
    });
    if (!supportChat) {
      throw new NotFoundException('Chat de suporte não encontrado');
    }

    const mediaUrl = this.storageService.getPublicUrl(media_key);
    this.logger.log(`Enviando ${media_type} para ${chat_id}`);

    const enviadoEm = new Date();
    const sentMessage = await this.whatsappService.sendMedia(supportChat.channel.session_id, {
      to: chat_id,
      mediaType: media_type,
      media: mediaUrl,
      mimetype,
      caption,
      fileName: file_name,
      quotedMessageId: quoted_message_id,
    });

    this.redisCacheRepository.set(
      `mediaMessage:messageId:${sentMessage.messageId}`,
      JSON.stringify(sentMessage),
      30,
    );

    await this.registraEnvio({
      messageId: sentMessage.messageId,
      supportChat,
      to: chat_id,
      content: caption ?? '',
      type: TIPO_INTERNO_POR_MIDIA[media_type],
      mediaUrl: media_key,
      mediaType: mimetype,
      quotedMsgId: quoted_message_id,
      sentAt: enviadoEm,
    });

    return { status: 'media sent', message_id: sentMessage.messageId };
  }

  /**
   * Persiste a mensagem recém-enviada, sem deixar a falha derrubar o envio: o
   * provider já aceitou, e o webhook ainda vai gravá-la de todo modo.
   */
  private async registraEnvio(dados: {
    messageId: string;
    supportChat: SupportChats;
    to: string;
    content: string;
    type: MessageTypes;
    mediaUrl?: string;
    mediaType?: string;
    quotedMsgId?: string;
    sentAt: Date;
  }) {
    try {
      await runInTransaction(this.dataSource, (manager) =>
        this.messagesService.saveOutgoing(
          { ...dados, channel: dados.supportChat.channel },
          manager,
        ),
      );
    } catch (err) {
      this.logger.warn(`Não foi possível registrar o envio ${dados.messageId}: ${err.message}`);
    }
  }

  async listAllSupportChats() {
    return this.supportChatsRepository.findAllSupportChats();
  }

  async findSupportChatsById(id: number) {
    const supportChatMessages = await this.supportChatsRepository.findSupportChatsById(id);
    if (!supportChatMessages) {
      throw new NotFoundException('Chat de suporte não encontrado');
    }
    if (supportChatMessages?.user && supportChatMessages.user.avatar_url) {
      supportChatMessages.user.avatar_url = this.storageService.getPublicUrl(
        supportChatMessages.user.avatar_url,
      );
    }
    return this.messagesService.getUrlForMessageMedia(supportChatMessages);
  }

  async sendReactionMessage(id: number, chat_id: string, messageId: string, reaction: string) {
    try {
      this.logger.log(
        `Enviando reação para ${chat_id} na mensagem ${messageId} com reação: ${reaction}`,
      );
      const supportChat = await this.supportChatsRepository.findOne({
        where: { id },
        relations: ['channel'],
      });
      if (!supportChat) {
        throw new NotFoundException('Chat de suporte não encontrado');
      }

      await this.whatsappService.sendReaction(
        supportChat.channel.session_id,
        chat_id,
        messageId,
        reaction,
      );
    } catch (error) {
      this.logger.error('Falha ao enviar reação:', error.response?.data || error.message);
      throw new BadRequestException('Não foi possível enviar a reação.');
    }
  }

  /**
   * Revoga a mensagem no WhatsApp. A marcação local fica por conta do webhook
   * `messages.delete`, que é quem confirma que o WhatsApp aceitou a revogação.
   */
  async deleteMessage(id: number, messageId: string) {
    const supportChat = await this.supportChatsRepository.findOne({
      where: { id },
      relations: ['channel', 'contact'],
    });
    if (!supportChat) {
      throw new NotFoundException('Chat de suporte não encontrado');
    }

    const message = await this.messagesService.findByMessageId(messageId);
    if (!message) {
      throw new NotFoundException('Mensagem não encontrada');
    }

    this.logger.log(`Apagando mensagem ${messageId} de ${supportChat.contact?.remote_jid}`);

    await this.whatsappService.deleteMessage(
      supportChat.channel.session_id,
      supportChat.contact?.remote_jid,
      messageId,
      message.from_me,
    );

    return { status: 'message deleted' };
  }

  async signMediaPost(signMediaPostDto: SignMediaPostDto): Promise<PresignedUpload> {
    try {
      let mediaName: string;

      mediaName = `${signMediaPostDto.key}/${randomUUID()}.${signMediaPostDto.fileType.split('/')[1]}`;

      const media_url = await this.storageService.createPresignedPost(
        mediaName,
        signMediaPostDto.fileType,
      );

      return media_url;
    } catch (err) {
      this.logger.error(err.message);
      throw err;
    }
  }

  // ====== Event Listeners Handles ======
  async onMessageCreate(payload: WhatsappWebhookPayload<MessagePayload>) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const { sessionId, data } = payload;
        const channel = await this.channelsRepository.findBySessionId(sessionId);
        const phoneContact = data.message.id.remote;

        const contact = await this.contactsService.findOrCreateByRemoteJid(
          {
            sessionId,
            remote_jid: phoneContact,
            name: data?.message?._data?.notifyName || 'Cliente',
          },
          manager,
        );

        const supportChat = await this.findOrOpen(contact.id, channel.id, manager);

        const savedMessage = await this.messagesService.saveIncoming(
          channel,
          supportChat,
          data.message,
          manager,
        );

        if (savedMessage) {
          // `lastMessage` só vem preenchido quando a mensagem afetada era a
          // última da conversa; nas demais, a prévia do chat não muda.
          if (savedMessage.lastMessage) {
            await this.supportChatsRepository.updateLastMessage(
              supportChat.id,
              savedMessage.lastMessage,
              manager,
            );
            this.whatsappChatStateEmit({
              ...supportChat,
              last_message: savedMessage.lastMessage.content,
              last_message_type: savedMessage.lastMessage.type,
              last_message_id: savedMessage.lastMessage.id,
            });
          }

          const supoportChatsWhitMessage = {
            ...supportChat,
            supportChatMessages: savedMessage,
          };

          this.whatsappService.emitEvent('whatsapp:messages', supoportChatsWhitMessage);
        }
      } catch (err) {
        this.logger.error(`Erro ao processar mensagem: ${err.message}`);
        throw err;
      }
    });
  }

  async onMessageAck(payload: WhatsappWebhookPayload<MessagePayload>) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const { data } = payload;

        // A mensagem é localizada pelo próprio id, sem passar pelo contato: o
        // ack chega com `remoteJid` no formato `@lid`, que não corresponde ao
        // `remote_jid` gravado. Mensagem desconhecida (sincronização inicial da
        // sessão, por exemplo) simplesmente não tem o que atualizar.
        const savedMessage = await this.messagesService.saveMessageAck(data.message, manager);

        if (savedMessage) {
          this.whatsappService.emitEvent('whatsapp:message_ack', savedMessage);
        }
      } catch (err) {
        this.logger.error(`Erro ao processar mensagem ack: ${err.message}`);
        throw err;
      }
    });
  }

  async onMessageEdit(payload: WhatsappWebhookPayload<MessageEditPayload>) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const { sessionId, data } = payload;
        const channel = await this.channelsRepository.findBySessionId(sessionId);
        const phoneContact = data.message.id.remote;

        const contact = await manager.findOneBy(Contacts, {
          remote_jid: phoneContact,
        });

        // Edição de mensagem de uma conversa desconhecida: nada a atualizar.
        if (!contact) {
          this.logger.debug(`Edição ignorada: contato ${phoneContact} não cadastrado.`);
          return;
        }

        const supportChat = await this.findOrOpen(contact.id, channel.id, manager);

        const savedMessage = await this.messagesService.saveMessageEdited(
          supportChat,
          data.message,
          manager,
        );

        if (savedMessage) {
          await this.supportChatsRepository.updateLastMessage(
            supportChat.id,
            savedMessage?.lastMessage,
            manager,
          );
          this.whatsappChatStateEmit({
            ...supportChat,
            last_message: savedMessage?.lastMessage?.content,
            last_message_type: savedMessage?.lastMessage?.type,
            last_message_id: savedMessage?.lastMessage?.id,
          });

          const supoportChatsWhitMessage = {
            ...supportChat,
            supportChatMessages: savedMessage,
          };

          this.whatsappService.emitEvent('whatsapp:messages', supoportChatsWhitMessage);
        }
      } catch (err) {
        this.logger.error(`Erro ao processar mensagem edit: ${err.message}`);
        throw err;
      }
    });
  }

  async onMessageRevokeEveryone(payload: WhatsappWebhookPayload<MessageEditPayload>) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const { data } = payload;
        const messageId = data.message.protocolMessageKey.id;

        // A conversa vem da própria mensagem, não do JID: a revogação feita no
        // aparelho chega com `remoteJid` em formato `@lid`, que não bate com o
        // `remote_jid` do contato.
        const mensagem = await this.messagesService.findByMessageId(messageId);
        if (!mensagem) {
          this.logger.debug(`Revogação ignorada: mensagem ${messageId} não encontrada.`);
          return;
        }

        const supportChat = await this.supportChatsRepository.findOne({
          where: { id: mensagem.support_chat_id },
        });
        if (!supportChat) {
          this.logger.debug(`Revogação ignorada: chat ${mensagem.support_chat_id} não encontrado.`);
          return;
        }

        const savedMessage = await this.messagesService.saveMessageRevokeEveryone(
          supportChat,
          data.message,
          manager,
        );

        if (savedMessage) {
          // `lastMessage` só vem preenchido quando a mensagem afetada era a
          // última da conversa; nas demais, a prévia do chat não muda.
          if (savedMessage.lastMessage) {
            await this.supportChatsRepository.updateLastMessage(
              supportChat.id,
              savedMessage.lastMessage,
              manager,
            );
            this.whatsappChatStateEmit({
              ...supportChat,
              last_message: savedMessage.lastMessage.content,
              last_message_type: savedMessage.lastMessage.type,
              last_message_id: savedMessage.lastMessage.id,
            });
          }

          const supoportChatsWhitMessage = {
            ...supportChat,
            supportChatMessages: savedMessage,
          };

          this.whatsappService.emitEvent('whatsapp:messages', supoportChatsWhitMessage);
        }
      } catch (err) {
        this.logger.error(`Erro ao processar mensagem: ${err.message}`);
        throw err;
      }
    });
  }

  async onMessageReaction(payload: WhatsappWebhookPayload<ReactionPayload>) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const { sessionId, data } = payload;

        const channel = await this.channelsRepository.findBySessionId(sessionId);
        const phoneContact = data.reaction.msgId.remote;

        const contact = await manager.findOneBy(Contacts, {
          remote_jid: phoneContact,
        });

        if (!contact) {
          this.logger.debug(`Reação ignorada: contato ${phoneContact} não cadastrado.`);
          return;
        }

        const supportChat = await this.findOrOpen(contact.id, channel.id, manager);

        const savedMessage = await this.messagesService.saveMessageReaction(
          supportChat.id,
          data.reaction,
          manager,
        );

        if (savedMessage) {
          const supoportChatsWhitMessage = {
            ...supportChat,
            supportChatMessages: savedMessage,
          };
          this.whatsappService.emitEvent('whatsapp:messages', supoportChatsWhitMessage);
        }
      } catch (err) {
        this.logger.error(`Erro ao processar mensagem: ${err.message}`);
        throw err;
      }
    });
  }

  async onMessagesUnreadCount(payload: WhatsappWebhookPayload<ChatPayload>) {
    return runInTransaction(this.dataSource, async (manager) => {
      try {
        const { sessionId, data } = payload;
        const channel = await this.channelsRepository.findBySessionId(sessionId);
        const phoneContact = data.chat.id._serialized;

        // `chats.update` identifica o contato pelo `@lid`, e não pelo JID que
        // gravamos — por isso a busca considera os dois endereços.
        const contact = await manager.findOneBy(Contacts, {
          remote_jid: phoneContact,
        });

        // Conversa que ainda não existe aqui: não há contagem a atualizar.
        if (!contact) {
          this.logger.debug(`Contagem ignorada: contato ${phoneContact} não cadastrado.`);
          return;
        }

        const supportChat = await this.findOrOpen(contact.id, channel.id, manager);

        await manager.update(SupportChats, supportChat.id, {
          unread_count: data.chat.unreadCount || 0,
        });

        this.whatsappService.emitEvent('whatsapp:unread_count', {
          chatId: supportChat.id,
          unreadCount: data.chat.unreadCount || 0,
        });
      } catch (err) {
        this.logger.error(`Erro ao processar mensagem: ${err.message}`);
        throw err;
      }
    });
  }

  async findOrOpen(
    contact_id: number,
    channel_id: number,
    manager: EntityManager,
    user_id?: number,
  ) {
    return await this.supportChatsRepository.findOrOpen(contact_id, channel_id, manager, user_id);
  }

  whatsappChatStateEmit(supportChat: SupportChats) {
    this.whatsappService.emitEvent('whatsapp:chat_state', supportChat);
  }
}
