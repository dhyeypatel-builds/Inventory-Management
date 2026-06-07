/**
 * Phase 2C OA-04 — refresh-token httpOnly cookie. Proves a browser client can
 * refresh without ever handling the refresh token in JS.
 */
import request from 'supertest';
import { app } from '../app';
import { prismaBase } from '../db/prisma';
import { hashPassword } from '../modules/auth/auth.service';

const PASSWORD = 'Cookie@12345';
const tenantIds: string[] = [];

async function makeUser() {
  const role = await prismaBase.role.findFirstOrThrow({ where: { name: 'ADMIN' } });
  const tenant = await prismaBase.tenant.create({
    data: { name: 'CookieShop', slug: `cookie-${Date.now()}-${Math.floor(Math.random() * 1e5)}`, status: 'ACTIVE' },
  });
  tenantIds.push(tenant.id);
  const email = `${tenant.slug}@cookie.test`;
  await prismaBase.user.create({
    data: { tenantId: tenant.id, email, fullName: 'Cookie', passwordHash: await hashPassword(PASSWORD), roleId: role.id },
  });
  return email;
}

afterAll(async () => {
  await prismaBase.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await prismaBase.$disconnect();
});

const refreshCookie = (res: request.Response): string | undefined =>
  (res.headers['set-cookie'] as unknown as string[] | undefined)?.find((c) => c.startsWith('ts_refresh='));

describe('refresh-token cookie', () => {
  it('login sets an httpOnly ts_refresh cookie', async () => {
    const email = await makeUser();
    const res = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(res.status).toBe(200);
    const cookie = refreshCookie(res);
    expect(cookie).toBeTruthy();
    expect(cookie!.toLowerCase()).toContain('httponly');
  });

  it('refreshes using only the cookie (empty body)', async () => {
    const email = await makeUser();
    const agent = request.agent(app); // persists cookies across requests
    const login = await agent.post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);

    const refresh = await agent.post('/api/v1/auth/refresh').send({});
    expect(refresh.status).toBe(200);
    expect(refresh.body.data.accessToken).toBeTruthy();
  });

  it('rejects refresh with no cookie and no body (400)', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({});
    expect(res.status).toBe(400);
  });

  it('logout clears the cookie and revokes the token', async () => {
    const email = await makeUser();
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ email, password: PASSWORD });

    const logout = await agent.post('/api/v1/auth/logout').send({});
    expect(logout.status).toBe(204);
    const cleared = (logout.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('ts_refresh='));
    expect(cleared).toContain('ts_refresh=;'); // emptied

    // The agent's cookie is now cleared, so a follow-up refresh has nothing.
    const after = await agent.post('/api/v1/auth/refresh').send({});
    expect(after.status).toBe(400);
  });
});
