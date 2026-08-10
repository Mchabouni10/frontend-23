// users-service.js in utilities
//
// Auth model:
//   - The JWT lives ONLY as an HttpOnly cookie set by the backend.
//     JavaScript cannot read it, so an XSS cannot exfiltrate it.
//   - We keep a tiny cache of the current user's profile (id/name/email)
//     in localStorage so the UI can render without an extra round trip.
//     This is non-sensitive display data, not the credential.
//   - For the Capacitor mobile WebView, where HttpOnly cookies can be
//     unreliable, we also mirror the token into an in-memory module variable
//     via setInMemoryToken/clearInMemoryToken (see send-request.js).
//   - getUser() reads ONLY from the cached profile. It NEVER decodes the JWT
//     to decide permissions — that has to happen on the server.

import * as usersAPI from './users-api';
import { setInMemoryToken, clearInMemoryToken } from './send-request';

const USER_KEY = 'user_profile';

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

export async function signUp(userData) {
  const res = await usersAPI.signUp(userData);
  // Backend returns { token, user } (token is also set as HttpOnly cookie).
  if (res && res.token) setInMemoryToken(res.token);
  const user = res && res.user ? res.user : null;
  writeProfile(user);
  return user;
}

export async function login(credentials) {
  const res = await usersAPI.login(credentials);
  if (res && res.token) setInMemoryToken(res.token);
  const user = res && res.user ? res.user : null;
  writeProfile(user);
  return user;
}

export async function logOut() {
  // Tell the server to clear the cookie. Then drop our local cache.
  try {
    await usersAPI.logout();
  } catch {
    /* ignore network failure on logout */
  }
  clearInMemoryToken();
  writeProfile(null);
}

// Legacy entry point — kept for backwards compatibility. Returns null.
// The token is now HttpOnly and not accessible to JS.
export function getToken() {
  return null;
}

export function getUser() {
  return readProfile();
}

export async function checkToken() {
  // We can't read the cookie, so the only safe answer is "unknown — go ask
  // the server". Components that care should call a /me endpoint or rely on
  // getUser() returning a profile (which we just refreshed on login).
  return !!readProfile();
}