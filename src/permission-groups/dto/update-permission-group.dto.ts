import { PartialType } from '@nestjs/mapped-types';

import { CreatePermissionGroupDto } from './create-permission-group.dto';

/**
 * Todos os campos opcionais. `permission_ids` omitido mantém as permissões
 * atuais; presente, substitui a lista inteira.
 */
export class UpdatePermissionGroupDto extends PartialType(CreatePermissionGroupDto) {}
