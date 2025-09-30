import { getToken } from './users-service';

const API_URL = process.env.REACT_APP_API_URL;

export default async function sendRequest(endpoint, method = 'GET', payload = null) {
  const url = `${API_URL}${endpoint}`;
  console.log(`Requesting: ${url}`);
  console.log('Method:', method);
  console.log('Payload:', payload);
  
  const options = { method };
  
  if (payload) {
    options.headers = { 'Content-Type': 'application/json' };
    options.body = JSON.stringify(payload);
    console.log('Request body:', options.body);
  }
  
  const token = getToken();
  if (token) {
    options.headers = options.headers || {};
    options.headers.Authorization = `Bearer ${token}`;
  }
  
  console.log('Request options:', options);
  
  try {
    const res = await fetch(url, options);
    console.log('Response status:', res.status);
    console.log('Response headers:', Object.fromEntries(res.headers.entries()));
    
    if (res.ok) {
      const data = await res.json();
      console.log('Response data:', data);
      return data;
    }
    
    // Better error handling
    let errorText;
    try {
      const errorData = await res.json();
      errorText = errorData.message || errorData.error || JSON.stringify(errorData);
    } catch {
      errorText = await res.text();
    }
    
    console.error(`Request failed: ${res.status} - ${errorText}`);
    throw new Error(`Request failed: ${res.status} - ${errorText}`);
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}