import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Pedido de URL assinada para o anexo de uma resposta rápida.
 *
 * ⚠️ **Não recebe o caminho.** O `sign-media-post` do chat aceita o prefixo
 * vindo do corpo, o que deixa qualquer autenticado escrever onde quiser no
 * bucket. Aqui o prefixo é fixo no servidor (`quick-replies/`), e o corpo traz
 * só o que o servidor não tem como saber.
 */
export class AssinarAnexoDto {
  @IsString()
  @IsNotEmpty({ message: 'Informe o tipo do arquivo' })
  @MaxLength(100)
  fileType: string;

  /**
   * O nome original, de onde sai a extensão.
   *
   * Derivar a extensão do mimetype produz coisas como
   * `.vnd.openxmlformats-officedocument.wordprocessingml.document` num `.docx`
   * - é o que o `sign-media-post` do chat faz, e lá passa porque o `file_name`
   * carrega o nome de verdade. Num cadastro permanente, o arquivo ficaria com
   * esse nome para sempre.
   */
  @IsString()
  @IsNotEmpty({ message: 'Informe o nome do arquivo' })
  @MaxLength(255)
  fileName: string;
}
