import { Type } from 'class-transformer';
import { IsDateString, IsNotEmpty, IsOptional, ValidateNested } from 'class-validator';
import { CreateAtendimentoServicoDto } from './create-atendimento-servico.dto';

export class CreateAtendimentoDto {
  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  client_id: number;

  @IsOptional()
  contact_id: number;

  @IsOptional()
  user_id: number;

  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  @IsDateString({}, { message: (opt) => `Formato do campo ${opt.property} inválido` })
  data_referencia: string;

  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  hora_inicio: string;

  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  hora_fim: string;

  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  comentario: string; // cspell: disable-line

  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  tipo_entrada: string;

  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  esta_pago: number;

  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  atendimento_status_id: number;

  @ValidateNested({ each: true })
  @Type(() => CreateAtendimentoServicoDto)
  atendimentosServicos?: CreateAtendimentoServicoDto[];
}
