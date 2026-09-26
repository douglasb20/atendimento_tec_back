import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Sem `key` vindo do corpo, ao contrário de `SignAvatarDto` (usuários) - o
 * prefixo fica fixo no servidor (`ContactsService.signAvatar`), seguindo o
 * padrão mais seguro já adotado no chatbot (`sign-media` vs. o antigo
 * `sign-media-post`, que aceitava prefixo do body sem whitelist).
 */
export class SignContactAvatarDto {
  @IsString()
  @IsNotEmpty({ message: 'Este campo é obrigatório' })
  fileType: string;
}
