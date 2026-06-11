import { createHash } from 'crypto';

/**
 * sha256 hex digest. Used to store high-entropy secrets (invite tokens) at rest:
 * deterministic so lookups work, one-way so a DB read can't recover the secret.
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
