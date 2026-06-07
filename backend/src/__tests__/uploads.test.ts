/**
 * Phase 2C ST-01 — logo upload + tenant-scoped serve.
 */
import request from 'supertest';
import { app } from '../app';
import { prismaBase } from '../db/prisma';
import { hashPassword } from '../modules/auth/auth.service';
import { setStorage } from '../storage';
import { LocalStorageTransport } from '../storage/transports/local';
import type { PutObjectInput, StorageTransport, StoredObject } from '../storage/types';

const PASSWORD = 'Upload@123';

// In-memory storage so the endpoint tests don't touch disk.
class MemoryStorage implements StorageTransport {
  readonly name = 'memory';
  objects = new Map<string, Buffer>();
  async put({ tenantId, folder, filename, body }: PutObjectInput): Promise<StoredObject> {
    const key = `${tenantId}/${folder}/${filename}`;
    this.objects.set(key, body);
    return { key, url: `/api/v1/uploads/${key}` };
  }
  async get(key: string): Promise<Buffer> {
    const b = this.objects.get(key);
    if (!b) throw new Error('not found');
    return b;
  }
}

// 1x1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

async function makeTenant(name: string) {
  const role = await prismaBase.role.findFirstOrThrow({ where: { name: 'ADMIN' } });
  const tenant = await prismaBase.tenant.create({
    data: { name, slug: `${name}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`, status: 'ACTIVE' },
  });
  const email = `${tenant.slug}@upload.test`;
  await prismaBase.user.create({
    data: { tenantId: tenant.id, email, fullName: name, passwordHash: await hashPassword(PASSWORD), roleId: role.id },
  });
  const login = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
  return { id: tenant.id as string, token: login.body.data.accessToken as string };
}

let storage: MemoryStorage;
const tenantIds: string[] = [];

beforeAll(() => {
  storage = new MemoryStorage();
  setStorage(storage);
});

afterAll(async () => {
  setStorage(null);
  await prismaBase.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  await prismaBase.$disconnect();
});

describe('POST /uploads/logo', () => {
  it('stores an image and returns a tenant-scoped URL', async () => {
    const t = await makeTenant('LogoShop');
    tenantIds.push(t.id);

    const res = await request(app)
      .post('/api/v1/uploads/logo')
      .set(bearer(t.token))
      .attach('file', PNG, { filename: 'logo.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.data.url).toBe(`/api/v1/uploads/${res.body.data.key}`);
    expect(res.body.data.key.startsWith(`${t.id}/logos/`)).toBe(true);
  });

  it('rejects a non-image file with 400', async () => {
    const t = await makeTenant('BadMime');
    tenantIds.push(t.id);

    const res = await request(app)
      .post('/api/v1/uploads/logo')
      .set(bearer(t.token))
      .attach('file', Buffer.from('not an image'), { filename: 'x.txt', contentType: 'text/plain' });

    expect(res.status).toBe(400);
  });

  it('requires authentication', async () => {
    const res = await request(app)
      .post('/api/v1/uploads/logo')
      .attach('file', PNG, { filename: 'logo.png', contentType: 'image/png' });
    expect(res.status).toBe(401);
  });
});

describe('GET /uploads/:tenantId/:folder/:filename', () => {
  it('serves the owner tenant its own object, blocks another tenant', async () => {
    const owner = await makeTenant('Owner');
    const other = await makeTenant('Other');
    tenantIds.push(owner.id, other.id);

    const up = await request(app)
      .post('/api/v1/uploads/logo')
      .set(bearer(owner.token))
      .attach('file', PNG, { filename: 'logo.png', contentType: 'image/png' });
    const url = up.body.data.url as string;

    const mine = await request(app).get(url).set(bearer(owner.token));
    expect(mine.status).toBe(200);
    expect(mine.headers['content-type']).toContain('image/png');

    const theirs = await request(app).get(url).set(bearer(other.token));
    expect(theirs.status).toBe(403);
  });
});

describe('LocalStorageTransport', () => {
  it('round-trips bytes and rejects path traversal', async () => {
    const local = new LocalStorageTransport();
    const stored = await local.put({
      tenantId: 'unit-test-tenant',
      folder: 'logos',
      filename: 'rt.png',
      contentType: 'image/png',
      body: PNG,
    });
    const back = await local.get(stored.key);
    expect(back.equals(PNG)).toBe(true);

    await expect(local.get('../../etc/passwd')).rejects.toThrow();
  });
});
