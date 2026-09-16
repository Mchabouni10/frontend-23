import sendRequest from '../utilities/send-request';

const BASE_URL = '/api/customers';

export function getCustomers() {
  return sendRequest(BASE_URL, 'GET');
}

export function getCustomer(id) {
  return sendRequest(`${BASE_URL}/${id}`, 'GET');
}

export function createCustomer(customerData) {
  return sendRequest(BASE_URL, 'POST', customerData);
}

export function updateCustomer(id, customerData) {
  return sendRequest(`${BASE_URL}/${id}`, 'PUT', customerData);
}

export function deleteCustomer(id) {
  return sendRequest(`${BASE_URL}/${id}`, 'DELETE');
}
