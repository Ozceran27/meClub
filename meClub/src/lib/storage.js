import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const tokenKey = 'mc_token';

export async function getItem(k) {
  try { const v = await SecureStore.getItemAsync(k); if (v != null) return v; } catch {}
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    const v = localStorage.getItem(k);
    if (v != null) return v;
  }
  return AsyncStorage.getItem(k);
}

export async function setItem(k, v) {
  try { await SecureStore.setItemAsync(k, v); } catch {}
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.setItem(k, v);
  await AsyncStorage.setItem(k, v);
}

export async function delItem(k) {
  try { await SecureStore.deleteItemAsync(k); } catch {}
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') localStorage.removeItem(k);
  await AsyncStorage.removeItem(k);
}
