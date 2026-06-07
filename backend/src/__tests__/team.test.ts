/**
 * Phase 2C IN-02/IN-03 — staff invites + provisioning email.
 */
import request from 'supertest';
import { app } from '../app';
import { prismaBase } from '../db/prisma';
import { hashPassword } from '../modules/auth/auth.service';
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
