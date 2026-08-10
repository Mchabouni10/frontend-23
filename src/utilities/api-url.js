// Resolves API paths against REACT_APP_API_URL (production) or relative paths (dev proxy).
export function getApiUrl(endpoint) {
  const base = process.env.REACT_APP_API_URL || '';
  return `${base}${endpoint}`;
}
