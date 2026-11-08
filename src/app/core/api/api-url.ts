const apiUrl = import.meta.env.NG_APP_API_URL?.trim();

if (!apiUrl) {
  throw new Error('Укажите NG_APP_API_URL в корневом .env и перезапустите приложение.');
}

export const API_URL = apiUrl.replace(/\/+$/, '');
