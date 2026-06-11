/**
 * Phase 2C IN-02/IN-03 — staff invites + provisioning email.
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

const PASSWORD = 'Team@12345';
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });
let capture: Capture;
const tenantIds: string[] = [];

async function makeOwner(name: string) {
  const role = await prismaBase.role.findFirstOrThrow({ where: { name: 'ADMIN' } });
  const tenant = await prismaBase.tenant.create({
    data: { name, slug: `team-${Date.now()}-${Math.floor(Math.random() * 1e5)}`, status: 'ACTIVE' },
  });
  tenantIds.push(tenant.id);
  const email = `${tenant.slug}@team.test`;
  await prismaBase.user.create({
    data: { tenantId: tenant.id, email, fullName: name, passwordHash: await hashPassword(PASSWORD), roleId: role.id },
  });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
  return { tenantId: tenant.id, slug: tenant.slug, token: login.body.data.accessToken as string };
}

beforeEach(() => {
  capture = new Capture();
  setTransport(capture);
});

afterAll(async () => {
  setTransport(null);
  await prismaBase.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await prismaBase.$disconnect();
});

describe('staff invites', () => {
  it('invites a staff member, emails them, and lists them as pending', async () => {
    const owner = await makeOwner('OwnerA');
    const staffEmail = `staff-${Date.now()}@team.test`;

    const res = await request(app)
      .post('/api/v1/team/invites')
      .set(bearer(owner.token))
      .send({ fullName: 'Sally Staff', email: staffEmail, roleName: 'SALES' });

    expect(res.status).toBe(201);
    expect(res.body.data.roleName).toBe('SALES');
    expect(capture.sent.some((m) => m.to === staffEmail)).toBe(true);

    // The staff user exists, scoped to this tenant, passwordless + pending.
    const user = await prismaBase.user.findUnique({ where: { email: staffEmail } });
    expect(user?.tenantId).toBe(owner.tenantId);
    expect(user?.passwordHash).toBeNull();

    const list = await request(app).get('/api/v1/team').set(bearer(owner.token));
    expect(list.status).toBe(200);
    expect(list.body.data.members.some((m: { email: string }) => m.email === staffEmail)).toBe(true);
  });

  it('the invited staff member can sign in via OTP', async () => {
    const owner = await makeOwner('OwnerB');
    const staffEmail = `staff-otp-${Date.now()}@team.test`;
    await request(app)
      .post('/api/v1/team/invites')
      .set(bearer(owner.token))
      .send({ fullName: 'Otto OTP', email: staffEmail, roleName: 'INVENTORY' });

    await request(app).post('/api/v1/auth/otp/request').send({ email: staffEmail });
    const otpMail = capture.sent.find((m) => m.to === staffEmail && m.subject.includes('sign-in code'))!;
    const code = /\b(\d{6})\b/.exec(otpMail.text)![1];

    const verify = await request(app).post('/api/v1/auth/otp/verify').send({ email: staffEmail, code });
    expect(verify.status).toBe(200);
    expect(verify.body.data.user.role).toBe('INVENTORY');
    expect(verify.body.data.user.tenantId).toBe(owner.tenantId);
  });

  it('rejects a duplicate email with 409', async () => {
    const owner = await makeOwner('OwnerC');
    const dupe = `dupe-${Date.now()}@team.test`;
    const first = await request(app)
      .post('/api/v1/team/invites')
      .set(bearer(owner.token))
      .send({ fullName: 'First', email: dupe, roleName: 'SALES' });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post('/api/v1/team/invites')
      .set(bearer(owner.token))
      .send({ fullName: 'Second', email: dupe, roleName: 'SALES' });
    expect(second.status).toBe(409);
  });

  it('revokes a pending invite and removes the unused account', async () => {
    const owner = await makeOwner('OwnerD');
    const staffEmail = `revoke-${Date.now()}@team.test`;
    const inv = await request(app)
      .post('/api/v1/team/invites')
      .set(bearer(owner.token))
      .send({ fullName: 'Rev Oke', email: staffEmail, roleName: 'AUDITOR' });

    const del = await request(app)
      .delete(`/api/v1/team/invites/${inv.body.data.id}`)
      .set(bearer(owner.token));
    expect(del.status).toBe(204);

    const user = await prismaBase.user.findUnique({ where: { email: staffEmail } });
    expect(user).toBeNull();
  });

  it('is tenant-scoped: another owner cannot see or revoke the invite', async () => {
    const ownerA = await makeOwner('IsoA');
    const ownerB = await makeOwner('IsoB');
    const staffEmail = `iso-staff-${Date.now()}@team.test`;
    const inv = await request(app)
      .post('/api/v1/team/invites')
      .set(bearer(ownerA.token))
      .send({ fullName: 'Iso Staff', email: staffEmail, roleName: 'SALES' });

    // B's team list must not include A's invite/member.
    const listB = await request(app).get('/api/v1/team').set(bearer(ownerB.token));
    expect(listB.body.data.members.every((m: { email: string }) => m.email !== staffEmail)).toBe(true);

    // B cannot revoke A's invite (scoped lookup → 404).
    const delB = await request(app)
      .delete(`/api/v1/team/invites/${inv.body.data.id}`)
      .set(bearer(ownerB.token));
    expect(delB.status).toBe(404);
  });

  it('stores only a hash of the invite token; the emailed link still works', async () => {
    const owner = await makeOwner('HashShop');
    const staffEmail = `hash-${Date.now()}@team.test`;
    const inv = await request(app)
      .post('/api/v1/team/invites')
      .set(bearer(owner.token))
      .send({ fullName: 'Hash Staff', email: staffEmail, roleName: 'SALES' });
    expect(inv.status).toBe(201);

    // Raw token only exists in the email link.
    const mail = capture.sent.find((m) => m.to === staffEmail)!;
    const rawToken = /\/invite\/([a-f0-9]{64})/.exec(mail.text + mail.html)![1];

    const row = await prismaBase.invite.findUniqueOrThrow({ where: { id: inv.body.data.id } });
    expect(row.tokenHash).toBe(sha256Hex(rawToken));
    expect(row.tokenHash).not.toBe(rawToken);

    // The emailed link resolves on the public lookup.
    const lookup = await request(app).get(`/api/v1/auth/invite/${rawToken}`);
    expect(lookup.status).toBe(200);
    expect(lookup.body.data.email).toBe(staffEmail);
  });

  it('requires the team:manage permission', async () => {
    const owner = await makeOwner('PermShop');
    // Demote: issue a token via a SALES user (no team:manage).
    const salesRole = await prismaBase.role.findFirstOrThrow({ where: { name: 'SALES' } });
    const salesEmail = `sales-${Date.now()}@team.test`;
    await prismaBase.user.create({
      data: { tenantId: owner.tenantId, email: salesEmail, fullName: 'Sales', passwordHash: await hashPassword(PASSWORD), roleId: salesRole.id },
    });
    const login = await request(app).post('/api/v1/auth/login').send({ email: salesEmail, password: PASSWORD });
    const res = await request(app).get('/api/v1/team').set(bearer(login.body.data.accessToken));
    expect(res.status).toBe(403);
  });
});

describe('member deactivation (PATCH /team/members/:id)', () => {
  it('deactivates a member, kills their sessions, and can reactivate', async () => {
    const owner = await makeOwner('DeactShop');
    const salesRole = await prismaBase.role.findFirstOrThrow({ where: { name: 'SALES' } });
    const email = `deact-${Date.now()}@team.test`;
    const member = await prismaBase.user.create({
      data: { tenantId: owner.tenantId, email, fullName: 'Leaver', passwordHash: await hashPassword(PASSWORD), roleId: salesRole.id },
    });
    // Give them a live session.
    const login = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(login.status).toBe(200);

    const res = await request(app)
      .patch(`/api/v1/team/members/${member.id}`)
      .set(bearer(owner.token))
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);

    // Refresh tokens revoked + password login refused.
    const live = await prismaBase.refreshToken.count({ where: { userId: member.id, revokedAt: null } });
    expect(live).toBe(0);
    const reLogin = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(reLogin.status).toBe(401);

    // Reactivate restores access.
    const back = await request(app)
      .patch(`/api/v1/team/members/${member.id}`)
      .set(bearer(owner.token))
      .send({ isActive: true });
    expect(back.status).toBe(200);
    const loginAgain = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
    expect(loginAgain.status).toBe(200);
  });

  it('refuses self-deactivation and removing the last active admin', async () => {
    const owner = await makeOwner('LastAdminShop');
    const me = await prismaBase.user.findFirstOrThrow({
      where: { tenantId: owner.tenantId, role: { name: 'ADMIN' } },
    });

    const self = await request(app)
      .patch(`/api/v1/team/members/${me.id}`)
      .set(bearer(owner.token))
      .send({ isActive: false });
    expect(self.status).toBe(409);

    // A second admin can't deactivate the only OTHER admin if that would leave
    // zero active admins — covered by deactivating the sole admin from a peer.
    const adminRole = await prismaBase.role.findFirstOrThrow({ where: { name: 'ADMIN' } });
    const email = `second-admin-${Date.now()}@team.test`;
    await prismaBase.user.create({
      data: { tenantId: owner.tenantId, email, fullName: 'Second Admin', passwordHash: await hashPassword(PASSWORD), roleId: adminRole.id },
    });
    const second = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });

    // Second admin deactivates the first — allowed (one active admin remains)…
    const ok = await request(app)
      .patch(`/api/v1/team/members/${me.id}`)
      .set(bearer(second.body.data.accessToken))
      .send({ isActive: false });
    expect(ok.status).toBe(200);

    // …but now they are the last active admin and cannot be deactivated,
    // no matter whose (still-valid) token asks.
    const secondUser = await prismaBase.user.findUniqueOrThrow({ where: { email } });
    const blocked = await request(app)
      .patch(`/api/v1/team/members/${secondUser.id}`)
      .set(bearer(owner.token))
      .send({ isActive: false });
    expect(blocked.status).toBe(409);
  });

  it('is tenant-scoped: cannot deactivate another tenant\'s member', async () => {
    const ownerA = await makeOwner('ScopeA');
    const ownerB = await makeOwner('ScopeB');
    const memberB = await prismaBase.user.findFirstOrThrow({ where: { tenantId: ownerB.tenantId } });

    const res = await request(app)
      .patch(`/api/v1/team/members/${memberB.id}`)
      .set(bearer(ownerA.token))
      .send({ isActive: false });
    expect(res.status).toBe(404);
  });
});

describe('provisioning emails the owner invite (IN-02)', () => {
  it('sends a branded invite email on provision', async () => {
    // Authenticate as a platform admin.
    const PLATFORM_EMAIL = 'team-test-platform@tyrestock.test';
    await prismaBase.platformAdmin.upsert({
      where: { email: PLATFORM_EMAIL },
      update: { passwordHash: await hashPassword(PASSWORD), isActive: true },
      create: { email: PLATFORM_EMAIL, fullName: 'Plat', passwordHash: await hashPassword(PASSWORD) },
    });
    const plogin = await request(app)
      .post('/api/v1/platform/auth/login')
      .send({ email: PLATFORM_EMAIL, password: PASSWORD });
    const slug = `prov-${Date.now()}`;
    const res = await request(app)
      .post('/api/v1/platform/tenants')
      .set(bearer(plogin.body.data.accessToken))
      .send({ name: 'Provisioned Co', slug, ownerEmail: `${slug}@team.test`, ownerName: 'Prov Owner' });

    expect(res.status).toBe(201);
    tenantIds.push(res.body.data.tenant.id);
    const mail = capture.sent.find((m) => m.to === `${slug}@team.test`);
    expect(mail).toBeTruthy();
    expect(mail!.html).toContain(res.body.data.invite.token);

    await prismaBase.platformAdmin.deleteMany({ where: { email: PLATFORM_EMAIL } });
  });
});
