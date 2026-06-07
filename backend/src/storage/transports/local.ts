import { mkdir, writeFile, readFile } from 'fs/promises';
import { dirname, join, resolve, normalize } from 'path';
import { env } from '../../config/env';
import type { PutObjectInput, StorageTransport, StoredObject } from '../types';

/**
 * Local-disk transport (dev). Objects live under STORAGE_LOCAL_DIR resolved from
 * the backend cwd, keyed `<tenantId>/<folder>/<filename>`. Objects are fetched
 * back through the authenticated /api/v1/uploads route (see modules/uploads).
 */
export class LocalStorageTransport implements StorageTransport {
  readonly name = 'local';
  private readonly root = resolve(process.cwd(), env.STORAGE_LOCAL_DIR);

  private absolute(key: string): string {
    // Guard against path traversal: the resolved path must stay under root.
    const abs = resolve(this.root, normalize(key));
    if (abs !== this.root && !abs.startsWith(this.root + '/')) {
      throw new Error('Invalid storage key');
    }
    return abs;
  }

  async put({ tenantId, folder, filename, body }: PutObjectInput): Promise<StoredObject> {
    const key = `${tenantId}/${folder}/${filename}`;
    const abs = this.absolute(key);
    await mkdir(dirname(abs), { recursive: true });
    await writeFile(abs, body);
    return { key, url: `/api/v1/uploads/${key}` };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.absolute(key));
  }
}

export const uploadsRoot = (): string => resolve(process.cwd(), env.STORAGE_LOCAL_DIR);
export { join as joinPath };
