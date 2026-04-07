const AUTH_TOKEN_KEY = 'auth_token';

/**
 * @template T
 * @param {() => T} operation
 * @param {T} fallbackValue
 * @returns {T}
 */
const safeStorageOperation = (operation, fallbackValue) => {
  try {
    return operation();
  } catch {
    return fallbackValue;
  }
};

export const initializeAuthTokenFromLegacyStorage = () => {
  const sessionToken = safeStorageOperation(() => globalThis.sessionStorage.getItem(AUTH_TOKEN_KEY), /** @type {string | null} */ (null));

  if (sessionToken) {
    return sessionToken;
  }

  const legacyToken = safeStorageOperation(() => globalThis.localStorage.getItem(AUTH_TOKEN_KEY), /** @type {string | null} */ (null));

  if (legacyToken) {
    safeStorageOperation(() => {
      globalThis.sessionStorage.setItem(AUTH_TOKEN_KEY, legacyToken);
      globalThis.localStorage.removeItem(AUTH_TOKEN_KEY);
      return true;
    }, false);
    return legacyToken;
  }

  return null;
};

export const getAuthToken = () => {
  const sessionToken = safeStorageOperation(() => globalThis.sessionStorage.getItem(AUTH_TOKEN_KEY), /** @type {string | null} */ (null));
  return sessionToken || null;
};

/**
 * @param {string} token
 */
export const setAuthToken = (token) => {
  safeStorageOperation(() => {
    globalThis.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    globalThis.localStorage.removeItem(AUTH_TOKEN_KEY);
    return true;
  }, false);
};

export const clearAuthToken = () => {
  safeStorageOperation(() => {
    globalThis.sessionStorage.removeItem(AUTH_TOKEN_KEY);
    globalThis.localStorage.removeItem(AUTH_TOKEN_KEY);
    return true;
  }, false);
};

export default {
  initializeAuthTokenFromLegacyStorage,
  getAuthToken,
  setAuthToken,
  clearAuthToken
};
