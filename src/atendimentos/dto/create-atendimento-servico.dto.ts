import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateAtendimentoServicoDto {
  
  @IsOptional()
  id?: number;
  
  @IsOptional()
  id_atendimento?: number;
  
  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  id_service: number;

  @IsOptional()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber({}, { message: (opt) => `Campo ${opt.property} aceita somente formato numérico` })
  valor_cobrado: number;
}