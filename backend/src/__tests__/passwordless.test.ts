/**
 * Phase 2C — passwordless auth: Email OTP, Google OAuth, invite lookup.
 */
import request from 'supertest';
import { app } from '../app';
import { prismaBase } from '../db/prisma';
import { hashPassword } from '../modules/auth/auth.service';
import { sha256Hex } from '../utils/hash';
import { setTransport } from '../email';
import type { EmailMessage, EmailTransport } from '../email/types';

class Capture implements EmailTransport {
  readonly name = 'cap';
  sent: EmailMessage[] = [];
  async send(m: EmailMessage): Promise<void> {
    this.sent.push(m);
  }
}

let capture: Capture;
const tenantIds: string[] = [];

const codeFrom = (msg: EmailMessage): string => /\b(\d{6})\b/.exec(msg.text)![1];

async function makeUser(opts: { status?: 'ACTIVE' | 'SUSPENDED'; isActive?: boolean } = {}) {
  const role = await prismaBase.role.findFirstOrThrow({ where: { name: 'ADMIN' } });
  const tenant = await prismaBase.tenant.create({
    data: {
      name: 'PwlShop',
      slug: `pwl-${Date.now()}-${Math.floor(Math.random() * 1e5)}`,
      status: opts.status ?? 'ACTIVE',
    },
  });
  tenantIds.push(tenant.id);
  const email = `${tenant.slug}@pwl.test`;
  const user = await prismaBase.user.create({
    data: {
      tenantId: tenant.id,
      email,
      fullName: 'Pwl Owner',
      passwordHash: null,
      isActive: opts.isActive ?? true,
      roleId: role.id,
    },
  });
  return { tenantId: tenant.id, email, userId: user.id };
}

beforeEach(() => {
  capture = new Capture();
  setTransport(capture);
});

afterAll(async () => {
  setTransport(null);
  await prismaBase.otpCode.deleteMany({ where: { email: { contains: '@pwl.test' } } });
  await prismaBase.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await prismaBase.$disconnect();
});

// ─── Email OTP ────────────────────────────────────────────────────────────────

describe('Email OTP', () => {
  it('requests a code and verifies it into a session', async () => {
    const { email, tenantId } = await makeUser();

    const reqRes = await request(app).post('/api/v1/auth/otp/request').send({ email });
    expect(reqRes.status).toBe(200);
    expect(capture.sent).toHaveLength(1);

    const code = codeFrom(capture.sent[0]);
    const verify = await request(app).post('/api/v1/auth/otp/verify').send({ email, code });

    expect(verify.status).toBe(200);
    expect(verify.body.data.accessToken).toBeTruthy();
    expect(verify.body.data.refreshToken).toBeTruthy();
    expect(verify.body.data.user.tenantId).toBe(tenantId);
    expect(verify.body.data.user.tenantName).toBe('PwlShop');
  });

  it('is enumeration-safe: unknown email returns 200 but sends nothing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/otp/request')
      .send({ email: 'nobody@pwl.test' });
    expect(res.status).toBe(200);
    expect(capture.sent).toHaveLength(0);
  });

  it('does not issue a code for a suspended tenant', async () => {
    const { email } = await makeUser({ status: 'SUSPENDED' });
    const res = await request(app).post('/api/v1/auth/otp/request').send({ email });
    expect(res.status).toBe(200);
    expect(capture.sent).toHaveLength(0);
  });

  it('rejects a wrong code and locks after repeated attempts', async () => {
    const { email } = await makeUser();
    await request(app).post('/api/v1/auth/otp/request').send({ email });
    const realCode = codeFrom(capture.sent[0]);
    const wrong = realCode === '000000' ? '111111' : '000000';

    for (let i = 0; i < 5; i++) {
      const r = await request(app).post('/api/v1/auth/otp/verify').send({ email, code: wrong });
      expect(r.status).toBe(400);
    }
    // Locked now — even the correct code fails.
    const after = await request(app).post('/api/v1/auth/otp/verify').send({ email, code: realCode });
    expect(after.status).toBe(400);
  });

  it('rejects an expired code', async () => {
    const { email } = await makeUser();
    await prismaBase.otpCode.create({
      data: {
        email,
        codeHash: await hashPassword('424242'),
        expiresAt: new Date(Date.now() - 60_000),
      },
    });
    const res = await request(app).post('/api/v1/auth/otp/verify').send({ email, code: '424242' });
    expect(res.status).toBe(400);
  });
});

// ─── First password for passwordless users ──────────────────────────────────────

describe('POST /auth/change-password (passwordless set)', () => {
  it('lets an OTP-authenticated passwordless user set a first password', async () => {
    const { email } = await makeUser();

    // Sign in via OTP (the only method available so far).
    await request(app).post('/api/v1/auth/otp/request').send({ email });
    const code = codeFrom(capture.sent.find((m) => m.to === email)!);
    const session = await request(app).post('/api/v1/auth/otp/verify').send({ email, code });
    expect(session.status).toBe(200);
    expect(session.body.data.user.hasPassword).toBe(false);
    const token = session.body.data.accessToken as string;

    // No currentPassword needed — there is none.
    const set = await request(app)
      .post('/api/v1/auth/change-password')
      .set({ Authorization: `Bearer ${token}` })
      .send({ newPassword: 'MyFirstPass@1' });
    expect(set.status).toBe(204);

    // Password login now works (and reports hasPassword).
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'MyFirstPass@1' });
    expect(login.status).toBe(200);
    expect(login.body.data.user.hasPassword).toBe(true);
  });

  it('still requires the current password once one exists', async () => {
    const { email, userId } = await makeUser();
    await prismaBase.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword('Existing@123') },
    });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Existing@123' });
    const token = login.body.data.accessToken as string;

    const res = await request(app)
      .post('/api/v1/auth/change-password')
      .set({ Authorization: `Bearer ${token}` })
      .send({ newPassword: 'Sneaky@12345' });
    expect(res.status).toBe(401);
  });
});

// ─── Invite lookup ──────────────────────────────────────────────────────────────

describe('GET /auth/invite/:token', () => {
  async function makeInvite(overrides: { expiresAt?: Date; acceptedAt?: Date } = {}) {
    const role = await prismaBase.role.findFirstOrThrow({ where: { name: 'ADMIN' } });
    const tenant = await prismaBase.tenant.create({
      data: { name: 'InviteShop', slug: `inv-${Date.now()}-${Math.floor(Math.random() * 1e5)}`, status: 'ACTIVE' },
    });
    tenantIds.push(tenant.id);
    const token = `tok-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    await prismaBase.invite.create({
      data: {
        tenantId: tenant.id,
        email: `${tenant.slug}@pwl.test`,
        roleId: role.id,
        tokenHash: sha256Hex(token),
        expiresAt: overrides.expiresAt ?? new Date(Date.now() + 86_400_000),
        acceptedAt: overrides.acceptedAt ?? null,
      },
    });
    return { token, tenantName: 'InviteShop' };
  }

  it('returns invite details for a valid token', async () => {
    const { token } = await makeInvite();
    const res = await request(app).get(`/api/v1/auth/invite/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.tenantName).toBe('InviteShop');
    expect(res.body.data.roleName).toBe('ADMIN');
  });

  it('rejects an expired invite with 410', async () => {
    const { token } = await makeInvite({ expiresAt: new Date(Date.now() - 1000) });
    const res = await request(app).get(`/api/v1/auth/invite/${token}`);
    expect(res.status).toBe(410);
  });

  it('rejects an already-used invite with 410', async () => {
    const { token } = await makeInvite({ acceptedAt: new Date() });
    const res = await request(app).get(`/api/v1/auth/invite/${token}`);
    expect(res.status).toBe(410);
  });
});
