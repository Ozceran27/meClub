import { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { useAuth } from '../features/auth/useAuth';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    setBusy(true); setErr('');
    try {
      await login({ email, password });
    } catch (e) {
      setErr('Credenciales inválidas o servidor no disponible');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="flex-1 bg-mc-bg px-6">
      <View className="mt-32" />
      <Text className="text-mc-text text-3xl font-bold mb-8">Bienvenido</Text>

      <View className="gap-4">
        <View>
          <Text className="text-mc-textDim mb-2">Email</Text>
          <TextInput
            className="bg-mc-surface text-mc-text rounded-xl2 px-4 py-3 border border-mc-stroke"
            placeholder="tu@email.com"
            placeholderTextColor="#7789a6"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        <View>
          <Text className="text-mc-textDim mb-2">Contraseña</Text>
          <TextInput
            className="bg-mc-surface text-mc-text rounded-xl2 px-4 py-3 border border-mc-stroke"
            placeholder="••••••••"
            placeholderTextColor="#7789a6"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {!!err && <Text className="text-red-400">{err}</Text>}

        <Pressable
          disabled={busy}
          onPress={submit}
          className="bg-mc-primary rounded-xl2 py-3 items-center mt-2"
        >
          {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Entrar</Text>}
        </Pressable>
      </View>
    </View>
  );
}
