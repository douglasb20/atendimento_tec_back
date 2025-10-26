import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AtendimentoChatService } from './atendimento-chat.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller('atendimento-chat')
export class AtendimentoChatController {
  constructor(private readonly atendimentoChatService: AtendimentoChatService) {}

  @Post('send-message')
  @HttpCode(HttpStatus.OK)
  async sendMessage(@Body() sendMessageDto: SendMessageDto) {
    await this.atendimentoChatService.sendMessage(sendMessageDto.to, sendMessageDto.message);
    return { status: 'message sent' };
  }
}
