import { IsNotEmpty, IsString } from 'class-validator';
import { SendMessageDto } from './send-message.dto';

export class ReplyMessageDto extends SendMessageDto {
  @IsString()
  @IsNotEmpty()
  message_id: string;
}
