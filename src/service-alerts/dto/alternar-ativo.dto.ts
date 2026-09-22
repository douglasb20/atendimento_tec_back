import { IsBoolean } from 'class-validator';

export class AlternarAtivoDto {
  @IsBoolean()
  ativo: boolean;
}
