import { Test, TestingModule } from '@nestjs/testing';
import { AtendimentoChatController } from './atendimento-chat.controller';
import { AtendimentoChatService } from './atendimento-chat.service';

describe('AtendimentoChatController', () => {
  let controller: AtendimentoChatController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AtendimentoChatController],
      providers: [AtendimentoChatService],
    }).compile();

    controller = module.get<AtendimentoChatController>(AtendimentoChatController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
