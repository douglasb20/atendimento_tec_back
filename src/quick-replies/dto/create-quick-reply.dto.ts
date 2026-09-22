import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { TipoAnexo } from '../entities/quick-replies.entity';

const TIPOS_ANEXO: TipoAnexo[] = ['image', 'video', 'audio', 'document'];

export class CreateQuickReplyDto {
  /**
   * O atalho, sem a barra.
   *
   * Só letras, números, ponto, hífen e sublinhado: a barra é o gatilho, e
   * espaço quebraria a detecção do token na caixa de mensagem - `/bom dia`
   * faria a lista fechar no espaço.
   */
  @IsString()
  @IsNotEmpty({ message: 'Informe o atalho' })
  @MaxLength(40, { message: 'O atalho deve ter no máximo 40 caracteres' })
  @Matches(/^[\w.-]+$/, {
    message: 'O atalho aceita apenas letras, números, ponto, hífen e sublinhado',
  })
  atalho: string;

  @IsString()
  @IsNotEmpty({ message: 'Informe a mensagem' })
  @MaxLength(2000, { message: 'A mensagem deve ter no máximo 2000 caracteres' })
  mensagem: string;

  /**
   * O anexo é opcional, mas **indivisível**: sem a key não há o que enviar, e
   * sem nome/mimetype/tipo o provider não sabe como tratar o arquivo. Por isso
   * os quatro campos são exigidos juntos quando a key vem.
   */
  @IsOptional()
  @IsString()
  @MaxLength(255)
  anexo_key?: string | null;

  @ValidateIf((dto: CreateQuickReplyDto) => Boolean(dto.anexo_key))
  @IsString()
  @IsNotEmpty({ message: 'O anexo precisa de um nome de arquivo' })
  @MaxLength(255)
  anexo_nome?: string | null;

  @ValidateIf((dto: CreateQuickReplyDto) => Boolean(dto.anexo_key))
  @IsString()
  @IsNotEmpty({ message: 'O anexo precisa de um mimetype' })
  @MaxLength(100)
  anexo_mimetype?: string | null;

  @ValidateIf((dto: CreateQuickReplyDto) => Boolean(dto.anexo_key))
  @IsIn(TIPOS_ANEXO, { message: `O tipo do anexo deve ser um de: ${TIPOS_ANEXO.join(', ')}` })
  anexo_tipo?: TipoAnexo | null;
}
