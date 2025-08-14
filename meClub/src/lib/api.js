import axios from 'axios';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const baseURL = Constants.expoConfig?.extra?.apiBaseUrl || 'http://localhost:3006/api';

export const api = axios.create({ baseURL });

// Adjunta JWT si existe
api.interceptors.request.use(async (config) => {
  try {
    const token = await SecureStore.getItemAsync('mc_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
});
