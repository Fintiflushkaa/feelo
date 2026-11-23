export type StoragePersistence = 'granted' | 'not-granted' | 'unsupported';

/** Best effort, НЕ гарантия от очистки, private mode или удаления данных самим пользователем. */
export async function requestStoragePersistence(
  manager?: StorageManager | null,
): Promise<StoragePersistence> {
  try {
    const storage = manager === undefined ? globalThis.navigator?.storage : manager;
    if (!storage || typeof storage.persist !== 'function') return 'unsupported';
    if (typeof storage.persisted === 'function' && (await storage.persisted())) return 'granted';
    return (await storage.persist()) ? 'granted' : 'not-granted';
  } catch {
    return 'not-granted';
  }
}
