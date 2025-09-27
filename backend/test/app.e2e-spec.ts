/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

type ApiResponse<T> = {
  success: boolean;
  data: T;
};

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/health (GET)', async () => {
    const httpServer = app.getHttpServer();
    const response = await request(httpServer).get('/health').expect(200);
    const body = response.body as ApiResponse<{ status: string }>;

    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ status: 'ok' }),
      }),
    );
  });
});
