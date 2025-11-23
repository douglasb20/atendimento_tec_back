import { Test, TestingModule } from '@nestjs/testing';
import { ClientService } from './clients.service';
import { Clients } from './entities/clients.entity';
import { Contacts } from '../contacts/entities/contacts.entity';
import { DataSource, DataSourceOptions } from 'typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Supports } from 'supports/entities/supports.entity';
import { Users } from 'users/entities/users.entity';
import { SupportStatus } from 'supports/entities/support-status.entity';
import { CreateClientDto } from './dto/create-client.dto';

describe('ClientService', () => {
  let module: TestingModule;
  let service: ClientService;
  // let clientsRepository: Repository<Clients>;
  // let contactsRepository: Repository<Contacts>;
  let dataSource: DataSource;
  let data: CreateClientDto;

  const dataSourceTest: DataSourceOptions = {
    type: 'sqlite',
    database: ':memory:',
    entities: [Clients, Contacts, Supports, Users, SupportStatus],
    synchronize: true,
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({ ...dataSourceTest, autoLoadEntities: true }),
        TypeOrmModule.forFeature([Clients, Contacts, Supports]),
      ],
      providers: [ClientService],
    }).compile();

    service = module.get<ClientService>(ClientService);
    // clientsRepository = module.get<Repository<Clients>>(getRepositoryToken(Clients));
    // contactsRepository = module.get<Repository<Contacts>>(getRepositoryToken(Contacts));
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
      contacts: [{ name: 'Douglas A. Silva', phone: '64992698043' }],
    };
    const result = await service.createClient(newData);

    expect(result.id).toBeDefined();
    expect(result.nome).toEqual(data.nome);
    expect(result.cnpj).toEqual(data.cnpj);
    expect(result.created_at).toBeDefined();
    expect(result.status).toEqual(1);
    expect(result.contacts[0].name).toEqual(newData.contacts[0].name);
    expect(result.contacts[0].phone).toEqual(newData.contacts[0].phone);
  });
});
