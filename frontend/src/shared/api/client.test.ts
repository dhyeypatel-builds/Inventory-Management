import axios, { AxiosError, type AxiosResponse } from 'axios';
import { api, tokenStore, setAuthFailureHandler } from '@/shared/api/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const setAdapter = (fn: (config: any) => Promise<any>): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (api.defaults as any).adapter = fn;
};

// A custom adapter must apply validateStatus itself (unlike the built-in
// adapters), so reject non-2xx the way axios's `settle` does.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const respond = (config: any, status: number, data: unknown): Promise<AxiosResponse> => {
  const response = { data, status, statusText: '', headers: {}, config } as AxiosResponse;
  if (status >= 200 && status < 300) return Promise.resolve(response);
  return Promise.reject(
    new AxiosError('Request failed', 'ERR_BAD_RESPONSE', config, null, response),
  );
};

describe('api client — 401 refresh interceptor', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    setAuthFailureHandler(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (api.defaults as any).adapter;
  });

  it('refreshes the access token on 401 (via cookie) and retries the original request', async () => {
    tokenStore.set('old-access');

    setAdapter((config) => {
      const auth = config.headers?.Authorization;
      if (config.url?.includes('/protected') && auth === 'Bearer old-access') {
        return respond(config, 401, {});
      }
      return respond(config, 200, { success: true, data: 'ok' });
    });

    // The refresh call carries no token in the body — the httpOnly cookie does.
    const postSpy = jest.spyOn(axios, 'post').mockResolvedValueOnce({
      data: { data: { accessToken: 'new-access' } },
    } as AxiosResponse);

    const res = await api.get('/protected');

    expect(res.data.data).toBe('ok');
    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(tokenStore.getAccess()).toBe('new-access');
  });

  it('clears the session and fires the auth-failure handler when refresh fails', async () => {
    tokenStore.set('old-access');
    const onFail = jest.fn();
    setAuthFailureHandler(onFail);

    setAdapter((config) => respond(config, 401, {}));
    jest.spyOn(axios, 'post').mockRejectedValueOnce(new Error('refresh failed'));

    await expect(api.get('/protected')).rejects.toBeTruthy();

    expect(tokenStore.getAccess()).toBeNull();
    expect(onFail).toHaveBeenCalledTimes(1);
  });

  it('does not try to refresh when the failing request is an auth endpoint', async () => {
    setAdapter((config) => respond(config, 401, { success: false }));
    const postSpy = jest.spyOn(axios, 'post');

    await expect(api.post('/auth/login', { email: 'x', password: 'y' })).rejects.toBeTruthy();

    expect(postSpy).not.toHaveBeenCalled();
  });
});
