import { Test, TestingModule } from '@nestjs/testing';
import { AtendimentoChatService } from './atendimento-chat.service';

describe('AtendimentoChatService', () => {
  let service: AtendimentoChatService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AtendimentoChatService],
    }).compile();

    service = module.get<AtendimentoChatService>(AtendimentoChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
