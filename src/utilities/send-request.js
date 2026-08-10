// src/utilities/send-request.js
//
// Auth model:
//   - The backend sets the JWT as an HttpOnly cookie on signup/login.
//   - The browser sends that cookie automatically with `credentials: 'include'`.
//   - The frontend never sees the JWT, so an XSS cannot steal it.
//   - We also send the Authorization header if a token is available (for
//     Capacitor mobile where cookies may not survive the WebView).
//
// Logging:
//   - All console output is gated on NODE_ENV !== 'production'.
//   - The Authorization header is *never* logged under any condition.

import { getApiUrl } from './api-url';

const isDev = process.env.NODE_ENV !== 'production';
const devLog = (...args) => { if (isDev) console.log(...args); };
const devErr = (...args) => { if (isDev) console.error(...args); };

// Optional in-memory token (for mobile WebView fallback). Not persisted.
let inMemoryToken = null;

export function setInMemoryToken(token) {
  inMemoryToken = token || null;
}

export function clearInMemoryToken() {
  inMemoryToken = null;
}

export default async function sendRequest(endpoint, method = 'GET', payload = null) {
  const url = getApiUrl(endpoint);
  devLog(`Requesting: ${url}`);
  devLog('Method:', method);

  const options = {
    method,
    credentials: 'include', // send HttpOnly cookies
    headers: {},
  };

  if (payload) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(payload);
    devLog('Payload:', payload);
  }

  if (inMemoryToken) {
    options.headers.Authorization = `Bearer ${inMemoryToken}`;
  }
  // Intentionally NOT logging `options` here — it can contain the
  // Authorization header, which is sensitive.

  let res;
  try {
    res = await fetch(url, options);
  } catch (networkErr) {
    devErr('Fetch error:', networkErr);
    throw new Error('Network error — please check your connection.');
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

  // Error path — never include the request body in the error message.
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
  const err = new Error(errorText || `Request failed: ${res.status}`);
  err.status = res.status;
  throw err;
}