import { Test, TestingModule } from '@nestjs/testing';
import { SupportChatsController } from './support-chats.controller';
import { SupportChatService } from './support-chats.service';

describe('SupportChatsController', () => {
  let controller: SupportChatsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupportChatsController],
      providers: [SupportChatService],
    }).compile();

    controller = module.get<SupportChatsController>(SupportChatsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
