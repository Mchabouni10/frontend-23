import sendRequest from '../utilities/send-request';
import { normalizeUSPhone } from '../utilities/phone';

const BASE_URL = '/api/customers';

// Only touch phone if the caller actually sent one — a partial update must
// never turn an untouched phone into ''.
const withNormalizedPhone = (data = {}) =>
  Object.prototype.hasOwnProperty.call(data, 'phone')
    ? { ...data, phone: normalizeUSPhone(data.phone) }
    : { ...data };

export function getCustomers() {
  return sendRequest(BASE_URL, 'GET');
}

export function getCustomer(id) {
  return sendRequest(`${BASE_URL}/${id}`, 'GET');
}

// Always creates (used by the Contacts directory when the user insists).
export function createCustomer(customerData) {
  return sendRequest(BASE_URL, 'POST', withNormalizedPhone(customerData));
}

// Duplicate-safe create. Resolves to one of:
//   { customer, created: true }                  new contact saved
//   { customer, created: false, reused: true }   the same person already existed (unchanged)
//   { customer: null, needsDecision: true, matches: [...] }
//        similar contact(s) exist; call again with { allowDuplicate: true } to create anyway
export function findOrCreateCustomer(customerData, { allowDuplicate = false } = {}) {
  return sendRequest(`${BASE_URL}/find-or-create`, 'POST', {
    ...withNormalizedPhone(customerData),
    ...(allowDuplicate ? { allowDuplicate: true } : {}),
  });
}

// Partial update. Pass { expectedUpdatedAt } so the server refuses (409) if the
// contact changed since the caller last loaded it.
export function updateCustomer(id, customerData, { expectedUpdatedAt } = {}) {
  return sendRequest(`${BASE_URL}/${id}`, 'PUT', {
    ...withNormalizedPhone(customerData),
    ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
  });
}

// { unlinkProjects: true } detaches linked projects first (they keep their own
// copy of the customer details), then deletes the contact.
export function deleteCustomer(id, { unlinkProjects = false } = {}) {
  return sendRequest(`${BASE_URL}/${id}${unlinkProjects ? '?unlinkProjects=true' : ''}`, 'DELETE');
}

export function getCustomerProjects(id) {
  return sendRequest(`${BASE_URL}/${id}/projects`, 'GET');
}

export function syncCustomersFromProjects() {
  // Walks every project, so allow far longer than the 20 s default timeout
  // (the server keeps working even if the browser gives up).
  return sendRequest(`${BASE_URL}/sync-from-projects`, 'POST', null, { timeoutMs: 120000 });
}