import { env } from '../config/env';
import type { StorageTransport } from './types';
import { LocalStorageTransport } from './transports/local';

let transport: StorageTransport | null = null;

export function getStorage(): StorageTransport {
  if (!transport) {
    if (env.STORAGE_TRANSPORT === 's3') {
      // S3/R2 transport is intentionally not wired yet (needs @aws-sdk/client-s3
      // + bucket credentials). Fail loud rather than silently mis-storing.
      throw new Error(
        'STORAGE_TRANSPORT=s3 is not implemented yet. Use STORAGE_TRANSPORT=local for now.',
      );
    }
    transport = new LocalStorageTransport();
  }
  return transport;
}

/** Test seam: swap the storage transport. */
export function setStorage(next: StorageTransport | null): void {
  transport = next;
}

export type { StorageTransport, StoredObject, PutObjectInput } from './types';
