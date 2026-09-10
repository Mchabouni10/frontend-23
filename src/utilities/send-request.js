// src/utilities/send-request.js
//
// Auth model:
//   - The backend sets the JWT as an HttpOnly cookie on signup/login/refresh.
//   - The browser sends that cookie automatically with `credentials: 'include'`.
//   - The frontend never sees the JWT, so an XSS cannot steal it.
//   - We also send the Authorization header if a token is available (for
//     Capacitor mobile where cookies may not survive the WebView).
//
// Session:
//   - 401s on protected routes invalidate the local session (see users-service).
//   - Login/signup/logout skip that handling so a bad password is not a logout.
//   - Requests time out so a sleeping API/DB cannot hang the UI indefinitely.

import { getApiUrl } from './api-url';

const isDev = process.env.NODE_ENV !== 'production';
const devLog = (...args) => { if (isDev) console.log(...args); };
const devErr = (...args) => { if (isDev) console.error(...args); };

export const REQUEST_TIMEOUT_MS = 20000;

let inMemoryToken = null;
let unauthorizedHandler = null;
let beforeRequestHandler = null;

export function getAuthHeaders() {
  return inMemoryToken
    ? { Authorization: `Bearer ${inMemoryToken}` }
    : {};
}

export function setInMemoryToken(token) {
  inMemoryToken = token || null;
}

export function clearInMemoryToken() {
  inMemoryToken = null;
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function setBeforeRequestHandler(handler) {
  beforeRequestHandler = handler;
}

export default async function sendRequest(
  endpoint,
  method = 'GET',
  payload = null,
  {
    timeoutMs = REQUEST_TIMEOUT_MS,
    skipAuthHandling = false,
    skipSessionRefresh = false,
  } = {},
) {
  if (!skipSessionRefresh && beforeRequestHandler) {
    await beforeRequestHandler();
  }

  const url = getApiUrl(endpoint);
  devLog(`Requesting: ${url}`);
  devLog('Method:', method);

  const options = {
    method,
    credentials: 'include',
    headers: {},
  };

  if (payload) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(payload);
    devLog('Payload:', payload);
  }

  Object.assign(options.headers, getAuthHeaders());

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  options.signal = controller.signal;

  let res;
  try {
    res = await fetch(url, options);
  } catch (networkErr) {
    if (networkErr?.name === 'AbortError') {
      const err = new Error('Request timed out. Please try again.');
      err.status = 408;
      throw err;
    }
    devErr('Fetch error:', networkErr);
    throw new Error('Network error — please check your connection.');
  } finally {
    clearTimeout(timeoutId);
  }

  devLog('Response status:', res.status);

  if (res.ok) {
    if (res.status === 204) {
      return { success: true };
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      devLog('Response data:', data);
      return data;
    }
    return { success: true };
  }

  let errorText;
  try {
    const errorData = await res.json();
    errorText = errorData.error || errorData.message || JSON.stringify(errorData);
  } catch {
    try {
      errorText = await res.text();
    } catch {
      errorText = `HTTP ${res.status}`;
    }
  }
  devErr(`Request failed: ${res.status} - ${errorText}`);

  if (res.status === 401 && !skipAuthHandling && unauthorizedHandler) {
    unauthorizedHandler();
  }

  const err = new Error(errorText || `Request failed: ${res.status}`);
  err.status = res.status;
  throw err;
}
