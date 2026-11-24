export function taskErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'storage-quota') {
    return 'Не удалось сохранить: в хранилище браузера закончилось место. Изменение не записано. Освободите место, не удаляя данные приложения, и повторите.';
  }
  return error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : String(error);
}
