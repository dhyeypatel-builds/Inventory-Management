import request from 'supertest';
import { app } from '../app';

describe('GET /api/v1/health', () => {
  it('returns 200 with success envelope', async () => {
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: { status: 'ok' },
    });
    expect(typeof res.body.data.timestamp).toBe('string');
  });
});

describe('Unknown route', () => {
  it('returns 404 with NOT_FOUND error envelope', async () => {
    const res = await request(app).get('/api/v1/this-route-does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      error: {
        code: 'NOT_FOUND',
      },
    });
  });

  it('returns 404 on POST to unknown route', async () => {
    const res = await request(app)
      .post('/api/v1/ghost-endpoint')
      .send({ foo: 'bar' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
