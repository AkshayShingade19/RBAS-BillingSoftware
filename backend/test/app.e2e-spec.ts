import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from '../src/app.module';
import { SeedService } from '../src/modules/seed/seed.service';
import { User } from '../src/modules/users/schemas/user.schema';

process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'e2e-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'e2e-refresh-secret';
process.env.SEED_ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin123!';
process.env.SEED_DEMO_DATA = process.env.SEED_DEMO_DATA || 'true';

const API = '/api/v1';

jest.setTimeout(180_000);

describe('Ledgerly API (e2e)', () => {
  let app: INestApplication;
  let connection: Connection;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri('ledgerly_e2e');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix(API);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();

    connection = app.get(getConnectionToken());
    await connection.dropDatabase();

    const seedService = app.get(SeedService);
    await seedService.seedAll();
  });

  afterAll(async () => {
    if (connection) await connection.dropDatabase();
    await app.close();
    if (mongod) await mongod.stop();
  });

  function login(email: string, password: string) {
    return request(app.getHttpServer()).post(`${API}/auth/login`).send({ email, password });
  }

  describe('Auth', () => {
    it('logs in the seeded administrator', async () => {
      const res = await login('superadmin@ledgerly.dev', 'Admin123!').expect(201);
      expect(res.body.tokens.accessToken).toBeDefined();
      expect(res.body.tokens.refreshToken).toBeDefined();
      expect(res.body.user.role).toBe('super_admin');
    });

    it('rejects invalid credentials', async () => {
      const res = await login('superadmin@ledgerly.dev', 'wrong-password');
      expect(res.status).toBe(401);
    });

    it('returns the current user with the access token', async () => {
      const { body } = await login('admin@ledgerly.dev', 'Admin123!').expect(201);
      const res = await request(app.getHttpServer())
        .get(`${API}/me`)
        .set('Authorization', `Bearer ${body.tokens.accessToken}`)
        .expect(200);
      expect(res.body.email).toBe('admin@ledgerly.dev');
    });

    it('rejects unauthenticated requests', async () => {
      await request(app.getHttpServer()).get(`${API}/users/me`).expect(401);
    });
  });

  describe('Clients', () => {
    let adminToken: string;

    beforeAll(async () => {
      const { body } = await login('admin@ledgerly.dev', 'Admin123!');
      adminToken = body.tokens.accessToken;
    });

    it('creates and lists a client', async () => {
      const createRes = await request(app.getHttpServer())
        .post(`${API}/clients`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Client Co',
          email: 'e2e@example.com',
          phone: '+1 555 0100',
        })
        .expect(201);
      expect(createRes.body.name).toBe('E2E Client Co');

      const listRes = await request(app.getHttpServer())
        .get(`${API}/clients`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(listRes.body.data.length).toBeGreaterThanOrEqual(1);
    });

    it('rejects a viewer without client permissions', async () => {
      const passwordHash = await bcrypt.hash('Viewer123!', 10);
      const viewer = await connection
        .model<User>('User')
        .create({
          name: 'E2E Viewer',
          email: 'e2e-viewer@example.com',
          passwordHash,
          role: 'viewer',
          status: 'active',
          emailVerified: true,
        });
      expect(viewer).toBeDefined();

      const { body } = await login('e2e-viewer@example.com', 'Viewer123!');
      await request(app.getHttpServer())
        .post(`${API}/clients`)
        .set('Authorization', `Bearer ${body.tokens.accessToken}`)
        .send({ name: 'Nope', email: 'nope@example.com' })
        .expect(403);
    });
  });

  describe('Invoice lifecycle', () => {
    let token: string;
    let clientId: string;

    beforeAll(async () => {
      const { body } = await login('admin@ledgerly.dev', 'Admin123!');
      token = body.tokens.accessToken;

      const client = await request(app.getHttpServer())
        .post(`${API}/clients`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Invoice Client', email: 'invoice@example.com' })
        .expect(201);
      clientId = client.body._id;
    });

    it('creates a draft invoice, sends it, and records a payment until paid', async () => {
      const created = await request(app.getHttpServer())
        .post(`${API}/invoices`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          clientId,
          dueDate: '2026-10-15',
          items: [
            { description: 'Consulting', quantity: 1, unitPrice: 1000, taxPercent: 10 },
          ],
        })
        .expect(201);
      expect(created.body.status).toBe('draft');
      expect(created.body.total).toBe(1100);
      const invoiceId = created.body.id;

      const sent = await request(app.getHttpServer())
        .post(`${API}/invoices/${invoiceId}/send`)
        .set('Authorization', `Bearer ${token}`)
        .expect(201);
      expect(sent.body.status).toBe('sent');

      const payment = await request(app.getHttpServer())
        .post(`${API}/payments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          invoiceId,
          amount: 1100,
          method: 'card',
          reference: 'E2E-PAY-001',
        })
        .expect(201);

      expect(payment.body.invoiceId).toBe(invoiceId);

      const paid = await request(app.getHttpServer())
        .get(`${API}/invoices/${invoiceId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(paid.body.status).toBe('paid');
      expect(paid.body.amountPaid).toBe(1100);
    });
  });
});