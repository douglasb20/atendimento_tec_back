import { PartialType } from '@nestjs/mapped-types';
import { CreateIntegrationDto } from './create-integration.dto';

/**
 * Todos os campos são opcionais na atualização. Omitir `credentials` preserva
 * as credenciais já gravadas — só são reescritas quando enviadas explicitamente.
 */
export class UpdateIntegrationDto extends PartialType(CreateIntegrationDto) {}
