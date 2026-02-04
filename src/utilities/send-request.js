// src/utilities/send-request.js
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
      // Handle 204 No Content responses (common for DELETE)
      if (res.status === 204) {
        console.log('No content response (204)');
        return { success: true };
      }
      
      // Check if response has content
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await res.json();
        console.log('Response data:', data);
        return data;
      }
      
      // Fallback for non-JSON responses
      console.log('Non-JSON response');
      return { success: true };
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