// src/utilities/expenses-api.js
import sendRequest from './send-request';

const BASE_URL = '/api/expenses';

export function createExpense(expenseData) {
  return sendRequest(BASE_URL, 'POST', expenseData);
}

export function getAllExpenses(filters = {}) {
  const params = new URLSearchParams(filters);
  return sendRequest(`${BASE_URL}?${params}`);
}

export function getDashboard() {
  return sendRequest(`${BASE_URL}/dashboard`);
}

export function getExpenseById(id) {
  return sendRequest(`${BASE_URL}/${id}`);
}

export function updateExpense(id, expenseData) {
  return sendRequest(`${BASE_URL}/${id}`, 'PUT', expenseData);
}

export function deleteExpense(id) {
  return sendRequest(`${BASE_URL}/${id}`, 'DELETE');
}

export function bulkDeleteExpenses(ids) {
  return sendRequest(`${BASE_URL}/bulk/delete`, 'POST', { ids });
}

export function getMonthlyReport(year) {
  return sendRequest(`${BASE_URL}/reports/monthly?year=${year}`);
}

export function getCategoryReport(startDate, endDate) {
  return sendRequest(`${BASE_URL}/reports/category?startDate=${startDate}&endDate=${endDate}`);
}

export function getVendorsReport(limit = 10) {
  return sendRequest(`${BASE_URL}/reports/vendors?limit=${limit}`);
}

export function importExpenses(expenses) {
  return sendRequest(`${BASE_URL}/import`, 'POST', { expenses });
}