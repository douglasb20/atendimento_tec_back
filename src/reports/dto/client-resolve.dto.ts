import { Type } from 'class-transformer';
import { IsIn, IsInt } from 'class-validator';

import { ClientReportGroupBy } from './report-filter.dto';

/**
 * Resolve o nome de um cliente/contato já escolhido, pelo `id` - usado
 * quando o relatório analítico abre pré-filtrado (ver `reports.service.ts:
 * resolverClienteOuContato`).
 */
export class ClientResolveDto {
  @Type(() => Number)
  @IsInt({ message: 'O id é inválido' })
  id: number;

  @IsIn(['client', 'contact'], { message: 'O tipo é inválido' })
  tipo: ClientReportGroupBy;
}
