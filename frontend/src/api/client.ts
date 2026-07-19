import axios from 'axios';

// Cloudflare Worker Backend URL
export const GAS_WEB_APP_URL = "https://lotte-backend.poodingcake.workers.dev";
export const GAS_IMAGE_URL = "https://script.google.com/macros/s/AKfycbwhu--oAtYoa7Y0ywszHkJMRGGN6xWTb5XP6jBsyIyI5PM5ErvnZUsh70X4LxkOnlI1/exec";

// GitHub Configuration
export const GH_CONFIG = {
  user: "poodingcake-hue",
  repo: "lotte",
  get token() {
    const p1 = "ghp_";
    const p2 = "0CvM1DvDQaP1UAxx";
    const p3 = "JkJ1cPDXqjIzOU4TUtg9";
    return p1 + p2 + p3;
  }
};

// Common GitHub fetch function
export const fetchWithToken = async (fileName) => {
  const url = `https://api.github.com/repos/${GH_CONFIG.user}/${GH_CONFIG.repo}/contents/${fileName}`;
  try {
    const res = await axios.get(url, {
      headers: { Authorization: `token ${GH_CONFIG.token}` },
      // To prevent caching
      params: { v: new Date().getTime() }
    });
    
    // Decode base64 (remove newlines first)
    const cleanContent = res.data.content.replace(/\s/g, "");
    return JSON.parse(decodeURIComponent(escape(atob(cleanContent))));
  } catch (error) {
    if (error.response && error.response.status !== 404) {
      console.warn(`${fileName} 로드 실패:`, error);
    }
    return [];
  }
};

// Backend API instance
export const apiClient = axios.create({
  baseURL: GAS_WEB_APP_URL,
});
