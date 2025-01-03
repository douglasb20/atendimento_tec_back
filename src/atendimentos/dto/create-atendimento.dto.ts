import { IsDate, IsDateString, IsNotEmpty } from "class-validator";

export class CreateAtendimentoDto {

  @IsNotEmpty({message:(opt) => `Campo ${opt.property} é obrigatório`})
  clients_id: number;

  contacts_id: number;
  users_id: number;

  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  @IsDateString({ },{message:(opt) => `Formato do campo ${opt.property} inválido`})
  data_referencia: string;

  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  hora_inicio: string;

  @IsNotEmpty({ message: (opt) => `Campo ${opt.property} é obrigatório` })
  hora_fim: string;

  @IsNotEmpty({message:(opt) => `Campo ${opt.property} é obrigatório`})
  comentario: string; // cspell: disable-line

  @IsNotEmpty({message:(opt) => `Campo ${opt.property} é obrigatório`})
  tipo_entrada: string;

  @IsNotEmpty({message:(opt) => `Campo ${opt.property} é obrigatório`})
  esta_pago: number;

  @IsNotEmpty({message:(opt) => `Campo ${opt.property} é obrigatório`})
  atendimento_status_id: number;
}