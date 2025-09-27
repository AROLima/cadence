import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = moduleRef.get<AppController>(AppController);
  });

  it('should return health payload', () => {
    const result = appController.health();
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('ok');
    expect(typeof result.data.timestamp).toBe('string');
  });
});
