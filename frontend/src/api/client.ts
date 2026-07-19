import axios from 'axios';

// Cloudflare Worker Backend URL
export const GAS_WEB_APP_URL = "https://lotte-backend.poodingcake.workers.dev";
// Backend API instance
export const apiClient = axios.create({
  baseURL: GAS_WEB_APP_URL,
});
