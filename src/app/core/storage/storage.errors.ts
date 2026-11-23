export class StorageQuotaError extends Error {
  readonly code = 'storage-quota' as const;
  constructor(readonly original: unknown) {
    super('storage-quota');
    this.name = 'StorageQuotaError';
  }
}

/** Dexie может оборачивать DOMException в inner. */
export function isStorageQuotaFailure(error: unknown): boolean {
  if (error instanceof StorageQuotaError) return true;
  const seen = new Set<unknown>();
  let current = error;
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    if ('name' in current && current.name === 'QuotaExceededError') return true;
    current = 'inner' in current ? current.inner : 'cause' in current ? current.cause : null;
  }
  return false;
}

export function storageFailure(error: unknown): never {
  if (isStorageQuotaFailure(error))
    throw error instanceof StorageQuotaError ? error : new StorageQuotaError(error);
  throw error;
}
