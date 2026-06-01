import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login with missing fields returns 400', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({})
      .expect(400);
  });

  it('POST /auth/register with missing fields returns 400', () => {
    return request(app.getHttpServer())
      .post('/auth/register')
      .send({})
      .expect(400);
  });

  it('GET /workspaces without token returns 401', () => {
    return request(app.getHttpServer())
      .get('/workspaces')
      .expect(401);
  });
});