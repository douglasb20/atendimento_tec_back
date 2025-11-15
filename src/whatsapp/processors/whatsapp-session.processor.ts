import { ChannelsService } from '@/channels/channels.service';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { DataTypeWhatsapp, WhatsappWebhookPayload } from '@types';
import { Job } from 'bullmq';

@Processor('whatsapp-session-queue')
export class WhatsappSessionProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsappSessionProcessor.name);

  @Inject()
  private readonly channelsService: ChannelsService;

  async process(job: Job<WhatsappWebhookPayload<any>>): Promise<boolean> {
    const payload = job.data;

    try {
      this.logger.log(`Processando evento de sessão do WhatsApp: ${payload.dataType}`);
      switch (payload.dataType) {
        case DataTypeWhatsapp.QR_RECEIVED:
          await this.channelsService.handleQrCodeReceived(payload);
          break;

        case DataTypeWhatsapp.AUTHENTICATED:
          await this.channelsService.handleChannelAuthenticated(payload);
          break;

        case DataTypeWhatsapp.READY:
          await this.channelsService.handleChannelReady(payload);
          break;
      }

      return true;
    } catch (error) {
      this.logger.error('Erro ao processar evento WhatsApp via Bull:', error);
      throw error;
    }
  }
}
