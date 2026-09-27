import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Pedido de URL assinada para o anexo da saudação ou da despedida do canal.
 *
 * ⚠️ **Não recebe o caminho.** O `sign-media-post` do chat aceita o prefixo
 * vindo do corpo, o que deixa qualquer autenticado escrever onde quiser no
 * bucket. Aqui o prefixo é fixo no servidor (`channels/`), e o corpo traz só o
 * que o servidor não tem como saber.
 */
export class AssinarAnexoCanalDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o tipo do arquivo' })
  @MaxLength(100)
  fileType: string;

  /**
   * O nome original, de onde sai a extensão.
   *
   * Derivar a extensão do mimetype produz coisas como
   * `.vnd.openxmlformats-officedocument.wordprocessingml.document` num `.docx`
   * - tolerável na mídia de chat, onde o `file_name` carrega o nome de
   * verdade, mas aqui o arquivo fica com esse nome para sempre.
   */
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do arquivo' })
  @MaxLength(255)
  fileName: string;
}
