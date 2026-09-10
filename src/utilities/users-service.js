// users-service.js in utilities
//
// Auth model:
//   - The JWT lives ONLY as an HttpOnly cookie set by the backend.
//     JavaScript cannot read it, so an XSS cannot exfiltrate it.
//   - We keep a tiny cache of the current user's profile (id/name/email)
//     in localStorage so the UI can render without an extra round trip.
//     This is non-sensitive display data, not the credential.
//   - expiresAt is stored so we can refresh the cookie before it dies.
//   - For the Capacitor mobile WebView, where HttpOnly cookies can be
//     unreliable, we also mirror the token into an in-memory module variable
//     via setInMemoryToken/clearInMemoryToken (see send-request.js).
//   - getUser() reads ONLY from the cached profile. It NEVER decodes the JWT
//     to decide permissions — that has to happen on the server.

import * as usersAPI from './users-api';
import {
  setInMemoryToken,
  clearInMemoryToken,
  setUnauthorizedHandler,
  setBeforeRequestHandler,
} from './send-request';

const USER_KEY = 'user_profile';
const EXPIRES_KEY = 'session_expires_at';
const REFRESH_SKEW_MS = 5 * 60 * 1000;

const authListeners = new Set();
let refreshTimer = null;
let refreshPromise = null;
let sessionActive = false;

function readProfile() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeProfile(user) {
  try {
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  } catch {
    /* localStorage unavailable — non-fatal */
  }
}

function readExpiresAt() {
  try {
    const raw = localStorage.getItem(EXPIRES_KEY);
    if (!raw) return null;
    const ms = Date.parse(raw);
    return Number.isNaN(ms) ? null : ms;
  } catch {
    return null;
  }
}

function writeExpiresAt(expiresAt) {
  try {
    if (expiresAt) localStorage.setItem(EXPIRES_KEY, expiresAt);
    else localStorage.removeItem(EXPIRES_KEY);
  } catch {
    /* localStorage unavailable — non-fatal */
  }
}

function notifyAuth(user, meta = {}) {
  authListeners.forEach((listener) => {
    try {
      listener(user, meta);
    } catch {
      /* listener errors must not break auth */
    }
  });
}

function stopRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

function scheduleRefresh() {
  stopRefreshTimer();
  const expiresAt = readExpiresAt();
  if (!expiresAt || !readProfile()) return;

  const delay = Math.max(0, expiresAt - Date.now() - REFRESH_SKEW_MS);
  refreshTimer = setTimeout(() => {
    refreshSession().catch(() => {});
  }, delay);
}

function clearLocalSession() {
  sessionActive = false;
  stopRefreshTimer();
  refreshPromise = null;
  clearInMemoryToken();
  writeProfile(null);
  writeExpiresAt(null);
}

function handleUnauthorized() {
  if (!sessionActive && !readProfile()) return;
  clearLocalSession();
  notifyAuth(null, { reason: 'expired' });
}

async function refreshSession() {
  if (!readProfile()) return null;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const res = await usersAPI.refresh();
    return applyAuthResponse(res, { reason: 'refresh', notify: false });
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function ensureFreshSession() {
  if (!readProfile()) return;
  if (refreshPromise) {
    await refreshPromise;
    return;
  }
  const expiresAt = readExpiresAt();
  if (!expiresAt) return;
  if (Date.now() < expiresAt - REFRESH_SKEW_MS) return;
  await refreshSession();
}

function applyAuthResponse(res, { reason = 'login', notify = true } = {}) {
  if (res && res.token) setInMemoryToken(res.token);
  const user = res && res.user ? res.user : null;
  writeProfile(user);
  if (res && res.expiresAt) {
    writeExpiresAt(res.expiresAt);
  } else if (user) {
    writeExpiresAt(new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString());
  }
  sessionActive = !!user;
  if (user) scheduleRefresh();
  else stopRefreshTimer();
  if (notify) notifyAuth(user, { reason });
  return user;
}

setUnauthorizedHandler(handleUnauthorized);
setBeforeRequestHandler(ensureFreshSession);

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      ensureFreshSession().catch(() => {});
    }
  });
}

export function subscribeAuth(listener) {
  authListeners.add(listener);
  return () => authListeners.delete(listener);
}

export async function signUp(userData) {
  const res = await usersAPI.signUp(userData);
  return applyAuthResponse(res, { reason: 'signup' });
}

export async function login(credentials) {
  const res = await usersAPI.login(credentials);
  return applyAuthResponse(res, { reason: 'login' });
}

export async function logOut() {
  stopRefreshTimer();
  try {
    await usersAPI.logout();
  } catch {
    /* ignore network failure on logout */
  }
  clearLocalSession();
  notifyAuth(null, { reason: 'logout' });
}

export async function bootstrapSession() {
  const profile = readProfile();
  if (!profile) {
    sessionActive = false;
    return null;
  }

  sessionActive = true;
  try {
    const res = await usersAPI.getMe();
    return applyAuthResponse(res, { reason: 'bootstrap', notify: false });
  } catch (err) {
    if (err.status === 401) return null;
    scheduleRefresh();
    return profile;
  }
}

export function getToken() {
  return null;
}

export function getUser() {
  return readProfile();
}

export async function checkToken() {
  const user = await bootstrapSession();
  return !!user;
}
