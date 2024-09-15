import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Atendimentos } from './entities/atendimento-entity';

@Injectable()
export class AtendimentosService {
  constructor(
    @InjectRepository(Atendimentos)
    private atendimentoRepository: Repository<Atendimentos>,
  ) { }
  
  async findAll() {
    return await this.atendimentoRepository.find({
      relations: ['atendimento_status', 'users', 'clients', 'contacts']
    })
  }
}
