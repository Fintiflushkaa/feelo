/** /api is forwarded by the development proxy (and the production reverse proxy). */
export const API_URL = (import.meta.env.NG_APP_API_URL?.trim() || '/api').replace(/\/+$/, '');
