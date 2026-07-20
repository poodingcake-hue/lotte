import axios from 'axios';

// Cloudflare Worker Backend URL from environment variable or fallback
export const GAS_WEB_APP_URL = import.meta.env.VITE_API_URL || "https://lotte-backend.poodingcake.workers.dev";

// Backend API instance
export const apiClient = axios.create({
  baseURL: GAS_WEB_APP_URL,
});

apiClient.interceptors.request.use((config) => {
  const apiKey = import.meta.env.VITE_BACKEND_API_KEY;
  if (apiKey && config.headers) {
    config.headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

