import axios from 'axios';

const defaultApiBase = import.meta.env.PROD ? 'https://go.lynkio.space' : 'http://localhost:8080';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || defaultApiBase,
  timeout: 15000,
});
