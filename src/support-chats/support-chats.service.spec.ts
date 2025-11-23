import { Test, TestingModule } from '@nestjs/testing';
import { SupportChatsService } from './support-chats.service';

describe('SupportChatService', () => {
  let service: SupportChatsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SupportChatsService],
    }).compile();

    service = module.get<SupportChatsService>(SupportChatsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
