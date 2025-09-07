import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const tokenKey = 'mc_token';

// Prefer SecureStore on native platforms for sensitive data such as tokens.
// AsyncStorage is only a fallback when SecureStore is unavailable (e.g. on
// web or when SecureStore throws). This avoids keeping tokens in the less
// secure AsyncStorage when we can store them in the device's encrypted key
// chain instead.
export async function getItem(k) {
  if (Platform.OS !== 'web') {
    try {
      const v = await SecureStore.getItemAsync(k);
      if (v != null) return v;
    } catch {
      // SecureStore failed, fall back to AsyncStorage
    }
  }
  return AsyncStorage.getItem(k);
}

export async function setItem(k, v) {
  if (Platform.OS !== 'web') {
    try {
      await SecureStore.setItemAsync(k, v);
      // Successful writes stop here so the token isn't duplicated in
      // AsyncStorage, which is less secure.
      return;
    } catch {
      // SecureStore failed, fall back to AsyncStorage
    }
  }
  await AsyncStorage.setItem(k, v);
}

export async function delItem(k) {
  if (Platform.OS !== 'web') {
    try {
      await SecureStore.deleteItemAsync(k);
      return;
    } catch {
      // SecureStore failed, fall back to AsyncStorage
    }
  }
  await AsyncStorage.removeItem(k);
}
