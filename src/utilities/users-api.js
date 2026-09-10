import sendRequest from './send-request';

const BASE_URL = '/api/users';

const publicAuth = { skipAuthHandling: true, skipSessionRefresh: true };
const sessionCall = { skipSessionRefresh: true };

export function signUp(userData) {
  return sendRequest(BASE_URL, 'POST', userData, publicAuth);
}

export function login(credentials) {
  return sendRequest(`${BASE_URL}/login`, 'POST', credentials, publicAuth);
}

export function logout() {
  return sendRequest(`${BASE_URL}/logout`, 'POST', null, publicAuth);
}

export function getMe() {
  return sendRequest(`${BASE_URL}/me`, 'GET', null, sessionCall);
}

export function refresh() {
  return sendRequest(`${BASE_URL}/refresh`, 'POST', null, sessionCall);
}
