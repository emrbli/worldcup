import { Test } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { WsAdapter } from '@nestjs/platform-ws';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

/**
 * Real end-to-end test — boots the full app (Fastify + DI graph) against the
 * live, seeded local Postgres. No mocks. Requires:
 *   docker compose up -d && pnpm migrate && pnpm seed && pnpm seed:content && pnpm seed:i18n
 *
 * Run: pnpm test:e2e
 */
describe('Worldcup API (e2e, real DB)', () => {
  let app: NestFastifyApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.useWebSocketAdapter(new WsAdapter(app));
    app.setGlobalPrefix('v1', { exclude: ['health'] });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    await app.listen(0, '127.0.0.1'); // random free port
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  const get = (path: string) => request(baseUrl).get(path);

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------
  it('GET /health → 200 ok', async () => {
    const res = await get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  // ---------------------------------------------------------------------------
  // Core: teams / groups / matches
  // ---------------------------------------------------------------------------
  it('GET /v1/teams → 48 teams', async () => {
    const res = await get('/v1/teams').expect(200);
    expect(res.body).toHaveLength(48);
  });

  it('GET /v1/teams?group=A → 4 teams', async () => {
    const res = await get('/v1/teams?group=A').expect(200);
    expect(res.body).toHaveLength(4);
  });

  it('GET /v1/teams has TR/EN i18n names', async () => {
    const res = await get('/v1/teams').expect(200);
    const withI18n = res.body.find(
      (t: { nameI18n?: { tr?: string; en?: string } }) =>
        t.nameI18n?.tr && t.nameI18n?.en,
    );
    expect(withI18n).toBeDefined();
  });

  it('GET /v1/groups → 12 groups of 4 teams', async () => {
    const res = await get('/v1/groups').expect(200);
    expect(res.body).toHaveLength(12);
    expect(
      res.body.every((g: { teams: unknown[] }) => g.teams.length === 4),
    ).toBe(true);
  });

  it('GET /v1/matches → 104 matches', async () => {
    const res = await get('/v1/matches').expect(200);
    expect(res.body).toHaveLength(104);
  });

  it('GET /v1/matches?stage=group → 72', async () => {
    const res = await get('/v1/matches?stage=group').expect(200);
    expect(res.body).toHaveLength(72);
  });

  it('GET /v1/matches?stage=r32 → 16', async () => {
    const res = await get('/v1/matches?stage=r32').expect(200);
    expect(res.body).toHaveLength(16);
  });

  it('GET /v1/matches?today=true → array (no error)', async () => {
    const res = await get('/v1/matches?today=true').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Match detail sub-resources
  // ---------------------------------------------------------------------------
  it('GET /v1/matches/:id → match with officials field', async () => {
    const list = await get('/v1/matches?stage=group').expect(200);
    const id = list.body[0].id as string;
    const res = await get(`/v1/matches/${id}`).expect(200);
    expect(res.body.id).toBe(id);
    expect(res.body).toHaveProperty('officials');
  });

  it('GET /v1/matches/:id/events → array before tournament', async () => {
    const list = await get('/v1/matches?stage=group').expect(200);
    const id = list.body[0].id as string;
    const res = await get(`/v1/matches/${id}/events`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /v1/matches/:id/lineups → array', async () => {
    const list = await get('/v1/matches?stage=group').expect(200);
    const id = list.body[0].id as string;
    const res = await get(`/v1/matches/${id}/lineups`).expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /v1/matches/not-a-uuid → 400', async () => {
    await get('/v1/matches/not-a-uuid').expect(400);
  });

  it('GET /v1/matches/<random uuid> → 404', async () => {
    await get('/v1/matches/00000000-0000-0000-0000-000000000000').expect(404);
  });

  // ---------------------------------------------------------------------------
  // Standings + bracket
  // ---------------------------------------------------------------------------
  it('GET /v1/standings?group=A → 4 rows', async () => {
    const res = await get('/v1/standings?group=A').expect(200);
    expect(res.body[0].standings).toHaveLength(4);
  });

  it('GET /v1/bracket → correct counts per round', async () => {
    const res = await get('/v1/bracket').expect(200);
    expect(res.body.r32).toHaveLength(16);
    expect(res.body.r16).toHaveLength(8);
    expect(res.body.qf).toHaveLength(4);
    expect(res.body.sf).toHaveLength(2);
    expect(res.body.third).toHaveLength(1);
    expect(res.body.final).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // Content
  // ---------------------------------------------------------------------------
  it('GET /v1/cities → 16 cities', async () => {
    const res = await get('/v1/cities').expect(200);
    expect(res.body).toHaveLength(16);
  });

  it('GET /v1/cities/:id/guide → guide with highlights', async () => {
    const cities = await get('/v1/cities').expect(200);
    const withGuide = cities.body.find(
      (c: { hasGuide: boolean }) => c.hasGuide,
    );
    const res = await get(`/v1/cities/${withGuide.id}/guide`).expect(200);
    // highlights present (wc26-mcp stores it as rich text) + fanZones array
    expect(res.body.highlights).toBeTruthy();
    expect(Array.isArray(res.body.fanZones)).toBe(true);
  });

  it('GET /v1/teams/:id/profile → coach present', async () => {
    const teams = await get('/v1/teams?group=A').expect(200);
    let found = false;
    for (const t of teams.body) {
      const res = await get(`/v1/teams/${t.id}/profile`);
      if (res.status === 200) {
        expect(res.body).toHaveProperty('coach');
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('GET /v1/fan-zones → 18', async () => {
    const res = await get('/v1/fan-zones').expect(200);
    expect(res.body).toHaveLength(18);
  });

  it('GET /v1/news → 13', async () => {
    const res = await get('/v1/news').expect(200);
    expect(res.body).toHaveLength(13);
  });

  it('GET /v1/odds → 16 tournament odds', async () => {
    const res = await get('/v1/odds').expect(200);
    expect(res.body).toHaveLength(16);
  });

  // ---------------------------------------------------------------------------
  // Devices (write path)
  // ---------------------------------------------------------------------------
  it('POST /v1/devices → 201', async () => {
    await request(baseUrl)
      .post('/v1/devices')
      .send({
        deviceId: 'e2e-test-device',
        platform: 'ios',
        pushToken: 'ExponentPushToken[e2e]',
      })
      .expect(201);
  });

  it('PATCH /v1/devices/:deviceId → 200', async () => {
    await request(baseUrl)
      .patch('/v1/devices/e2e-test-device')
      .send({ pushToken: 'ExponentPushToken[e2e-updated]' })
      .expect(200);
  });

  it('POST /v1/devices with invalid platform → 400', async () => {
    await request(baseUrl)
      .post('/v1/devices')
      .send({ deviceId: 'x', platform: 'windows' })
      .expect(400);
  });
});
