import { ArrayMinSize, IsIn, IsInt, IsNotEmpty, IsString, MaxLength, ValidateIf } from 'class-validator';

import { ChatbotType } from '../entities/chatbots.entity';

const TIPOS_VALIDOS: ChatbotType[] = ['entrada', 'saida', 'agendamento', 'complementar'];

export class CreateChatbotDto {
  @IsString({ message: (opt) => `Campo ${opt.property} aceita somente formato string` })
  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  @MaxLength(120)
  name: string;

  @IsIn(TIPOS_VALIDOS, { message: 'Tipo de chatbot inválido' })
  type: ChatbotType;

  /**
   * Canais em que este chatbot roda - M:N (migration `1790020000000`), o
   * mesmo chatbot pode ficar ligado a vários. Obrigatório (ao menos um) para
   * entrada/saída/agendamento; ausente/vazio para complementar (subfluxo não
   * amarra a canal nenhum).
   */
  @ValidateIf((dto: CreateChatbotDto) => dto.type !== 'complementar')
  @IsInt({ each: true, message: 'Selecione ao menos um canal válido' })
  @ArrayMinSize(1, { message: 'Selecione ao menos um canal' })
  channel_ids?: number[];
}
