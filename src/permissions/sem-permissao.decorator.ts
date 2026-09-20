import { SetMetadata } from '@nestjs/common';

export const SEM_PERMISSAO = 'sem_permissao';

/**
 * Libera o endpoint para qualquer usuário autenticado.
 *
 * Existe porque o `PermissionGuard` passou a **negar** quando não há
 * `@Permissions`: antes o padrão era liberar, e esquecer o decorator não
 * produzia erro nenhum — produzia acesso livre, em silêncio. Onze dos treze
 * endpoints de conversas estavam assim.
 *
 * Com a inversão, "liberado de propósito" precisa estar escrito. É o que este
 * decorator faz: a intenção fica no código, e a revisão consegue distinguir
 * o que é deliberado do que foi esquecido.
 */
export const SemPermissao = () => SetMetadata(SEM_PERMISSAO, true);
