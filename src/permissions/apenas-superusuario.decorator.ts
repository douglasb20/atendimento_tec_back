import { SetMetadata } from '@nestjs/common';

export const APENAS_SUPERUSUARIO = 'apenas_superusuario';

/**
 * Restringe o endpoint ao usuário master.
 *
 * Distinto de `@Permissions`: nenhum grupo de permissão alcança, nem o
 * Administrador. É para o que muda o comportamento do sistema inteiro -
 * conceder isso por grupo seria conceder demais.
 *
 * Podia ser uma checagem solta no controller, mas aí a regra some na leitura do
 * arquivo. Como decorator, ela fica ao lado da rota, junto das outras.
 */
export const ApenasSuperusuario = () => SetMetadata(APENAS_SUPERUSUARIO, true);
