// src/screens/LoginScreen.jsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../features/auth/useAuth';
import { api, authApi } from '../lib/api';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

const registerSchema = z.object({
  nombre: z.string().min(2, 'Ingresá tu nombre'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  rol: z.enum(['deportista', 'club']).default('deportista'),
  nombre_club: z.string().optional(),
});

const forgotSchema = z.object({
  email: z.string().email('Email inválido'),
});

const resetSchema = z.object({
  token: z.string().min(10, 'Token inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  confirm: z.string().min(6, 'Mínimo 6 caracteres'),
}).refine((d) => d.password === d.confirm, {
  message: 'Las contraseñas no coinciden',
  path: ['confirm'],
});

export default function LoginScreen() {
  const nav  = useNavigation();
  const { login, register, user, isLogged } = useAuth();

  useEffect(() => {
    if (isLogged) {
      nav.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    }
  }, [isLogged, nav, user]);

  // 'login' | 'register' | 'forgot' | 'reset'
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');
  const [ok,   setOk]   = useState('');

  const resolver = useMemo(() => {
    switch (mode) {
      case 'login':    return zodResolver(loginSchema);
      case 'register': return zodResolver(registerSchema);
      case 'forgot':   return zodResolver(forgotSchema);
      case 'reset':    return zodResolver(resetSchema);
      default:         return zodResolver(loginSchema);
    }
  }, [mode]);

  const {
    control, handleSubmit, reset, setValue,
    formState: { errors }
  } = useForm({
    resolver,
    defaultValues: {
      // login
      email: '', password: '',
      // register
      nombre: '', rol: 'deportista', nombre_club: '',
      // reset
      token: '', confirm: '',
    },
  });

  // Leer ?token= de la URL (web) para ir directo a reset
  useEffect(() => {
    if (Platform.OS === 'web') {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('token');
      if (t) {
        setMode('reset');
        setValue('token', t);
      }
    }
  }, [setValue]);

  // Limpiar estado al cambiar de modo
  useEffect(() => {
    setErr(''); setOk('');
    if (mode === 'login') {
      reset({ email: '', password: '' });
    } else if (mode === 'register') {
      reset({ nombre: '', email: '', password: '', rol: 'deportista', nombre_club: '' });
    } else if (mode === 'forgot') {
      reset({ email: '' });
    } else if (mode === 'reset') {
      reset({ token: '', password: '', confirm: '' });
      if (Platform.OS === 'web') {
        const params = new URLSearchParams(window.location.search);
        const t = params.get('token');
        if (t) setValue('token', t);
      }
    }
  }, [mode, reset, setValue]);

  const submitLogin = async ({ email, password }) => {
    setBusy(true); setErr(''); setOk('');
    try {
      await login({ email, password });
    } catch (e) {
      setErr(e.message || 'Credenciales inválidas');
    } finally { setBusy(false); }
  };

  const submitRegister = async (data) => {
    setBusy(true); setErr(''); setOk('');
    try {
      await register(data);
      nav.reset({ index: 0, routes: [{ name: 'Dashboard' }] });
    } catch (e) {
      setErr(e.message || 'No se pudo registrar');
    } finally { setBusy(false); }
  };

  const submitForgot = async ({ email }) => {
    setBusy(true); setErr(''); setOk('');
    try {
      const r = await authApi.forgot(email);
      setOk('Si el email existe, enviamos instrucciones a tu correo.');
      // En dev, puede venir {token, link}
      if (r?.token) {
        console.log('[DEV] Token reset:', r.token, 'Link:', r.link);
      }
    } catch (e) {
      setErr(e.message || 'No se pudo procesar la solicitud');
    } finally { setBusy(false); }
  };

  const submitReset = async ({ token, password }) => {
    setBusy(true); setErr(''); setOk('');
    try {
      await authApi.reset(token, password);
      setOk('Contraseña actualizada. Ahora podés iniciar sesión.');
      setMode('login');
      if (Platform.OS === 'web' && window?.history?.replaceState) {
        const url = new URL(window.location.href);
        url.searchParams.delete('token');
        window.history.replaceState({}, '', url.toString());
      }
    } catch (e) {
      setErr(e.message || 'No se pudo restablecer la contraseña');
    } finally { setBusy(false); }
  };

  const toggleMode = () => setMode(m => (m === 'login' ? 'register' : 'login'));

  const goForgot = () => setMode('forgot');
  const goReset  = () => setMode('reset');
  const goLogin  = () => setMode('login');

  const safeBack = () => {
    if (nav.canGoBack && nav.canGoBack()) nav.goBack();
    else nav.reset({ index: 0, routes: [{ name: 'Landing' }] });
  };

  return (
    <View className="flex-1 bg-mc-bg">
      {/* Header */}
      <View className="px-6 pt-6 pb-2">
        <Pressable
          onPress={safeBack}
          className="
            self-start flex-row items-center gap-2
            px-5 py-3 rounded-2xl
            border border-mc-stroke
            hover:border-mc-info
            hover:shadow-[0_0_24px_rgba(102,194,255,0.25)]
          "
        >
          <Text className="text-mc-text text-xl">←</Text>
          <Text className="text-mc-text text-xl font-semibold">Volver</Text>
        </Pressable>
      </View>

      {/* Contenedor central */}
      <View className="flex-1 items-center justify-center px-6">
        <View className="w-full max-w-md bg-mc-surface/60 backdrop-blur
                         border border-mc-stroke rounded-2xl p-6
                         shadow-[0_18px_40px_rgba(6,9,14,0.45)]">
          <Text className="text-mc-text text-3xl font-bold mb-2 text-center">
            {{
              login:    'Iniciar sesión',
              register: 'Crear cuenta',
              forgot:   'Olvidé mi contraseña',
              reset:    'Restablecer contraseña',
            }[mode]}
          </Text>

          <Text className="text-mc-textDim mb-8 text-center">
            {{
              login:    'Ingresá tus datos para continuar',
              register: 'Completá tus datos para unirte a meClub',
              forgot:   'Ingresá tu email y te enviaremos instrucciones',
              reset:    'Pegá el token y elegí tu nueva contraseña',
            }[mode]}
          </Text>

          <View className="gap-4">
            {/* REGISTER extra */}
            {mode === 'register' && (
              <>
                <Controller
                  control={control}
                  name="nombre"
                  render={({ field: { onChange, value } }) => (
                    <View>
                      <Text className="text-mc-textDim mb-2">Nombre</Text>
                      <TextInput
                        className="bg-mc-surface text-mc-text rounded-xl2 px-4 py-3 border border-mc-stroke"
                        placeholder="Tu nombre"
                        placeholderTextColor="#7789a6"
                        value={value}
                        onChangeText={onChange}
                      />
                      {errors.nombre && <Text className="text-red-400 mt-1">{errors.nombre.message}</Text>}
                    </View>
                  )}
                />

                <Controller
                  control={control}
                  name="rol"
                  render={({ field: { onChange, value } }) => (
                    <View className="flex-row gap-3 items-center">
                      <Pressable
                        onPress={() => onChange('deportista')}
                        className={`px-4 py-2 rounded-xl2 border ${value === 'deportista' ? 'border-mc-info shadow-[0_0_14px_rgba(76,201,240,0.25)]' : 'border-mc-stroke'}`}
                      >
                        <Text className="text-mc-text">Deportista</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => onChange('club')}
                        className={`px-4 py-2 rounded-xl2 border ${value === 'club' ? 'border-mc-info shadow-[0_0_14px_rgba(76,201,240,0.25)]' : 'border-mc-stroke'}`}
                      >
                        <Text className="text-mc-text">Club</Text>
                      </Pressable>
                    </View>
                  )}
                />

                <Controller
                  control={control}
                  name="nombre_club"
                  render={({ field: { onChange, value } }) => (
                    <View>
                      <Text className="text-mc-textDim mb-2">Nombre del club (solo si sos Club)</Text>
                      <TextInput
                        className="bg-mc-surface text-mc-text rounded-xl2 px-4 py-3 border border-mc-stroke"
                        placeholder="Mi Club Deportivo"
                        placeholderTextColor="#7789a6"
                        value={value}
                        onChangeText={onChange}
                      />
                    </View>
                  )}
                />
              </>
            )}

            {/* LOGIN / FORGOT: email */}
            {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
              <Controller
                control={control}
                name="email"
                render={({ field: { onChange, value } }) => (
                  <View>
                    <Text className="text-mc-textDim mb-2">Email</Text>
                    <TextInput
                      className="bg-mc-surface text-mc-text rounded-xl2 px-4 py-3 border border-mc-stroke"
                      placeholder="tu@email.com"
                      placeholderTextColor="#7789a6"
                      autoCapitalize="none"
                      keyboardType={Platform.OS === 'web' ? 'default' : 'email-address'}
                      value={value}
                      onChangeText={onChange}
                      onSubmitEditing={mode === 'login' ? handleSubmit(submitLogin) : undefined}
                    />
                    {errors.email && <Text className="text-red-400 mt-1">{errors.email.message}</Text>}
                  </View>
                )}
              />
            )}

            {/* LOGIN / REGISTER: password */}
            {(mode === 'login' || mode === 'register') && (
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, value} }) => (
                  <View>
                    <Text className="text-mc-textDim mb-2">Contraseña</Text>
                    <TextInput
                      className="bg-mc-surface text-mc-text rounded-xl2 px-4 py-3 border border-mc-stroke"
                      placeholder="••••••••"
                      placeholderTextColor="#7789a6"
                      secureTextEntry
                      value={value}
                      onChangeText={onChange}
                      onSubmitEditing={mode === 'login' ? handleSubmit(submitLogin) : undefined}
                    />
                    {errors.password && <Text className="text-red-400 mt-1">{errors.password.message}</Text>}
                  </View>
                )}
              />
            )}

            {/* RESET: token + nueva password + confirm */}
            {mode === 'reset' && (
              <>
                <Controller
                  control={control}
                  name="token"
                  render={({ field: { onChange, value } }) => (
                    <View>
                      <Text className="text-mc-textDim mb-2">Token</Text>
                      <TextInput
                        className="bg-mc-surface text-mc-text rounded-xl2 px-4 py-3 border border-mc-stroke"
                        placeholder="Pegá aquí el token"
                        placeholderTextColor="#7789a6"
                        autoCapitalize="none"
                        value={value}
                        onChangeText={onChange}
                      />
                      {errors.token && <Text className="text-red-400 mt-1">{errors.token.message}</Text>}
                    </View>
                  )}
                />
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, value } }) => (
                    <View>
                      <Text className="text-mc-textDim mb-2">Nueva contraseña</Text>
                      <TextInput
                        className="bg-mc-surface text-mc-text rounded-xl2 px-4 py-3 border border-mc-stroke"
                        placeholder="Nueva contraseña"
                        placeholderTextColor="#7789a6"
                        secureTextEntry
                        value={value}
                        onChangeText={onChange}
                      />
                      {errors.password && <Text className="text-red-400 mt-1">{errors.password.message}</Text>}
                    </View>
                  )}
                />
                <Controller
                  control={control}
                  name="confirm"
                  render={({ field: { onChange, value } }) => (
                    <View>
                      <Text className="text-mc-textDim mb-2">Confirmar contraseña</Text>
                      <TextInput
                        className="bg-mc-surface text-mc-text rounded-xl2 px-4 py-3 border border-mc-stroke"
                        placeholder="Repetí la contraseña"
                        placeholderTextColor="#7789a6"
                        secureTextEntry
                        value={value}
                        onChangeText={onChange}
                      />
                      {errors.confirm && <Text className="text-red-400 mt-1">{errors.confirm.message}</Text>}
                    </View>
                  )}
                />
              </>
            )}

            {!!err &&  <Text className="text-red-400">{err}</Text>}
            {!!ok &&   <Text className="text-emerald-400">{ok}</Text>}

            {/* CTA principal */}
            <Pressable
              disabled={busy}
              onPress={handleSubmit(
                mode === 'login'    ? submitLogin :
                mode === 'register' ? submitRegister :
                mode === 'forgot'   ? submitForgot :
                submitReset
              )}
              className="bg-mc-primary rounded-xl2 py-3 items-center mt-2
                         transition-transform duration-150 hover:-translate-y-0.5
                         hover:shadow-[0_12px_28px_rgba(43,130,128,0.35)]
                         active:opacity-95"
            >
              {busy ? <ActivityIndicator color="#fff" /> :
                <Text className="text-white font-semibold">
                  {{
                    login:    'Entrar',
                    register: 'Crear cuenta',
                    forgot:   'Enviar instrucciones',
                    reset:    'Actualizar contraseña',
                  }[mode]}
                </Text>
              }
            </Pressable>

            {/* Links secundarios */}
            {mode === 'login' && (
              <View className="mt-3 items-center gap-2">
                <Pressable onPress={toggleMode}><Text className="text-mc-textDim underline">¿No tenés cuenta? Crear cuenta</Text></Pressable>
                <Pressable onPress={goForgot}><Text className="text-mc-textDim underline">Olvidé mi contraseña</Text></Pressable>
                <Pressable onPress={goReset}><Text className="text-mc-textDim underline">Ya tengo un token</Text></Pressable>
              </View>
            )}
            {(mode === 'register' || mode === 'forgot' || mode === 'reset') && (
              <View className="mt-3 items-center">
                <Pressable onPress={goLogin}><Text className="text-mc-textDim underline">Volver a Iniciar sesión</Text></Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
