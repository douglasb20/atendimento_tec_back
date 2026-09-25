import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Pedido de URL assinada para o anexo de um nó Mensagem.
 *
 * ⚠️ **Não recebe o caminho.** O `sign-media-post` do chat aceita o prefixo
 * vindo do corpo, o que deixa qualquer autenticado escrever onde quiser no
 * bucket. Aqui o prefixo é fixo no servidor (`sistema/chatbot/`), mesmo padrão
 * de `AssinarAnexoDto` das respostas rápidas - e pela mesma razão fica fora do
 * cron de retenção (`MediaRetentionService`), que varre por registro em
 * `support_chat_messages`, nunca por prefixo de pasta: um anexo de nó nunca
 * vira mensagem, então nunca é candidato a expirar.
 */
export class AssinarMediaDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o tipo do arquivo' })
  @MaxLength(100)
  fileType: string;

  /**
   * O nome original, de onde sai a extensão - não do mimetype (produziria algo
   * como `.vnd.openxmlformats-officedocument.wordprocessingml.document` num
   * `.docx`). O anexo do nó Mensagem é permanente, então fica com essa
   * extensão para sempre.
   */
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do arquivo' })
  @MaxLength(255)
  fileName: string;
}
