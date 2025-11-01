import { Test, TestingModule } from '@nestjs/testing';
import { SupportsController } from './supports.controller';
import { SupportsService } from './supports.service';

describe('SupportsController', () => {
  let controller: SupportsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SupportsController],
      providers: [SupportsService],
    }).compile();

    controller = module.get<SupportsController>(SupportsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
