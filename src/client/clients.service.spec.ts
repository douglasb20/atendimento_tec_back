import { Test, TestingModule } from '@nestjs/testing';
import { ClientService } from './clients.service';
import { Clients } from './entities/clients.entity';
import { Contacts } from './entities/contacts.entity';
import { DataSource, DataSourceOptions, Repository } from 'typeorm';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { Atendimentos } from 'atendimentos/entities/atendimento-entity';
import { Users } from 'users/entities/users.entity';
import { AtendimentoStatus } from 'atendimentos/entities/atendimento-status-entity';
import { CreateClientDto } from './dto/create-client.dto';

describe('ClientService', () => {
  let module: TestingModule;
  let service: ClientService;
  let clientsRepository: Repository<Clients>;
  let contactsRepository: Repository<Contacts>;
  let dataSource: DataSource;
  let data: CreateClientDto;

  const dataSourceTest: DataSourceOptions = {
    type: 'sqlite',
    database: ':memory:',
    entities: [Clients, Contacts, Atendimentos, Users, AtendimentoStatus],
    synchronize: true,
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({ ...dataSourceTest, autoLoadEntities: true }),
        TypeOrmModule.forFeature([Clients, Contacts, Atendimentos]),
      ],
      providers: [ClientService],
    }).compile();

    service = module.get<ClientService>(ClientService);
    clientsRepository = module.get<Repository<Clients>>(getRepositoryToken(Clients));
    contactsRepository = module.get<Repository<Contacts>>(getRepositoryToken(Contacts));
    dataSource = module.get<DataSource>(DataSource);

    data = {
      nome: 'ManSystem',
      cnpj: '',
    };
  });

  afterAll(async () => {
    // Encerrar a conexão após todos os testes.
    await dataSource.destroy();
    await module.close();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a new client without contact', async () => {
    const result = await service.createClient(data);
    expect(result.id).toBeDefined();
    expect(result.nome).toEqual(data.nome);
    expect(result.cnpj).toEqual(data.cnpj);
    expect(result.created_at).toBeDefined();
    expect(result.status).toEqual(1);
    expect(result.contacts).toBeUndefined();
  });

  it('should create a new client with contact', async () => {
    const newData: CreateClientDto = {
      ...data,
      contacts: [{ nome_contato: 'Douglas A. Silva', telefone_contato: '64992698043' }],
    };
    const result = await service.createClient(newData);

    expect(result.id).toBeDefined();
    expect(result.nome).toEqual(data.nome);
    expect(result.cnpj).toEqual(data.cnpj);
    expect(result.created_at).toBeDefined();
    expect(result.status).toEqual(1);
    expect(result.contacts[0].nome_contato).toEqual(newData.contacts[0].nome_contato);
    expect(result.contacts[0].telefone_contato).toEqual(newData.contacts[0].telefone_contato);
  });
});
