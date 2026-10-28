// src/utilities/workers-api.js
// NOTE: uses the same `sendRequest` helper pattern as the other *-api.js files.
// If your expenses-api.js imports sendRequest differently, match that import.
import sendRequest from './send-request';

const BASE_URL = '/api/workers';

// Workers
export const getWorkers = () => sendRequest(BASE_URL);
export const createWorker = (data) => sendRequest(BASE_URL, 'POST', data);
export const updateWorker = (id, data) => sendRequest(`${BASE_URL}/${id}`, 'PUT', data);
export const deleteWorker = (id) => sendRequest(`${BASE_URL}/${id}`, 'DELETE');

// Agreed amount per worker per project
export const getAssignments = (projectId) =>
  sendRequest(`${BASE_URL}/assignments${projectId ? `?projectId=${projectId}` : ''}`);
export const saveAssignment = (data) => sendRequest(`${BASE_URL}/assignments`, 'PUT', data);
export const deleteAssignment = (id) => sendRequest(`${BASE_URL}/assignments/${id}`, 'DELETE');