export interface StoredObject {
  /** Storage key, e.g. "<tenantId>/<uuid>.png". */
  key: string;
  /** A URL the app can use to fetch the object back. */
  url: string;
}

export interface PutObjectInput {
  tenantId: string;
  /** Logical folder, e.g. "logos". */
  folder: string;
  filename: string;
  contentType: string;
  body: Buffer;
}

/** A storage transport persists binary objects. Implementations: local, s3. */
export interface StorageTransport {
  readonly name: string;
  put(input: PutObjectInput): Promise<StoredObject>;
  /** Resolve an object's bytes by key (used by server-side PDF rendering). */
  get(key: string): Promise<Buffer>;
}
