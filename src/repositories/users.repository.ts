import { InjectRepository } from '@nestjs/typeorm';
import { Users } from 'users/entities/users.entity';
import { Repository } from 'typeorm';

export class UsersRepository {
  constructor(@InjectRepository(Users) private usersRepository: Repository<Users>) {}

  repository = this.usersRepository;
}
