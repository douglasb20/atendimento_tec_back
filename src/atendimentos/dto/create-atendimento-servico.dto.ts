import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class CreateAtendimentoServicoDto {
  @IsOptional()
  id?: number;

  @IsOptional()
  atendimento_id?: number;

  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  service_id: number;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber({}, { message: (opt) => `Campo ${opt.property} aceita somente formato numérico` })
  valor_cobrado: number;
}
