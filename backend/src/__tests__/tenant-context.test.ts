/**
 * Phase 2A U-01: the AsyncLocalStorage tenant context.
 *
 * The headline guarantee is the concurrency test: two overlapping async
 * operations, each in its own tenant scope, must never observe each other's
 * tenant. A leak here would serve one shop's data to another under load.
 */
import { runWithTenant, currentTenant, getTenantContext } from '../tenancy/context';

const tick = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

describe('tenant context (AsyncLocalStorage)', () => {
  it('fails closed when called outside any request scope', () => {
    expect(getTenantContext()).toBeUndefined();
    expect(() => currentTenant()).toThrow(/no tenant context/i);
  });

  it('resolves the tenant within a run scope', () => {
    runWithTenant({ tenantId: 'tenant-A', platform: false }, () => {
      expect(currentTenant()).toBe('tenant-A');
      expect(getTenantContext()?.tenantId).toBe('tenant-A');
    });
  });

  it('does not leak context between concurrent async operations', async () => {
    async function op(tenantId: string, observed: string[]): Promise<string> {
      return runWithTenant({ tenantId, platform: false }, async () => {
        await tick();
        observed.push(currentTenant());
        await tick();
        observed.push(currentTenant());
        return currentTenant();
      });
    }

    const a: string[] = [];
    const b: string[] = [];
    const [ra, rb] = await Promise.all([op('tenant-A', a), op('tenant-B', b)]);

    expect(ra).toBe('tenant-A');
    expect(rb).toBe('tenant-B');
    // Each operation saw only its own tenant across every await boundary.
    expect(a).toEqual(['tenant-A', 'tenant-A']);
    expect(b).toEqual(['tenant-B', 'tenant-B']);
  });

  it('platform context without a pinned tenant fails closed', () => {
    runWithTenant({ tenantId: null, platform: true }, () => {
      expect(() => currentTenant()).toThrow(/impersonate/i);
    });
  });

  it('platform impersonation resolves the pinned tenant', () => {
    runWithTenant(
      { tenantId: null, platform: true, impersonatingTenantId: 'tenant-Z' },
      () => {
        expect(currentTenant()).toBe('tenant-Z');
      },
    );
  });
});
