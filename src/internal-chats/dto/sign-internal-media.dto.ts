import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Pede a URL assinada para subir um arquivo do chat interno.
 *
 * Mesmo desenho de `SignMediaPostDto` do atendimento: o front sobe o arquivo
 * direto para o storage e manda só a key na mensagem - o binário não passa pelo
 * backend.
 */
export class SignInternalMediaDto {
  /** O mimetype do arquivo, para compor a extensão da key. */
  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  @MaxLength(100)
  fileType: string;
}
