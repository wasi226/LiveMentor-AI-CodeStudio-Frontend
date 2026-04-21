const viteEnv = /** @type {any} */ (import.meta)?.env || {};

export function resolveApiBaseUrl() {
  const configured = String(viteEnv.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

  if (configured) {
    return configured;
  }

  const hostname = globalThis.window?.location?.hostname || '';
  const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (viteEnv.DEV || isLocalHost) {
    return 'http://localhost:3001';
  }

  return globalThis.window?.location?.origin || '';
}

export const API_BASE_URL = resolveApiBaseUrl();
