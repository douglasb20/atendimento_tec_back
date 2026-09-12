import { PartialType } from '@nestjs/mapped-types';

import { CreateContactsDto } from './create-contacts.dto';

/**
 * Todos os campos opcionais, como manda um PATCH.
 *
 * Herdando o DTO de criação direto, `name` continuava obrigatório - e associar
 * um contato a um cliente exigiria reenviar o nome junto, sem motivo.
 */
export class UpdateContactsDto extends PartialType(CreateContactsDto) {}
