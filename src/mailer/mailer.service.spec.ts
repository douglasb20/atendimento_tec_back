import { Test, TestingModule } from '@nestjs/testing';
import { ConfigMailerService } from './configmailer.service';

describe('ConfigMailerService', () => {
  let service: ConfigMailerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ConfigMailerService],
    }).compile();

    service = module.get<ConfigMailerService>(ConfigMailerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
