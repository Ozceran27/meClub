// src/screens/LoginScreen.jsx
import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, Platform, Keyboard } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useAuth } from '../features/auth/useAuth';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

const registerSchema = z.object({
  nombre: z.string().min(2, 'Ingresá tu nombre'),
  apellido: z.string().min(2, 'Ingresá tu apellido'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
  codigo_area: z
    .string()
    .min(1, 'Seleccioná un código de área')
    .refine((value) => ['+54', '+55', '+595'].includes(value), {
      message: 'Seleccioná un código de área válido',
    }),
  telefono: z
    .string()
    .min(6, 'Ingresá un teléfono válido')
    .max(20, 'Ingresá un teléfono válido')
    .regex(/^[0-9\s()-]+$/, 'Usá un formato telefónico válido'),
  rol: z.enum(['deportista', 'club']).default('deportista'),
  nombre_club: z.string().optional(),
  cuit: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.rol === 'club') {
    if (!data.nombre_club || !data.nombre_club.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Ingresá el nombre del club', path: ['nombre_club'] });
    }
    const cuitDigits = (data.cuit || '').replace(/\D/g, '');
    if (cuitDigits.length !== 11) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Ingresá un CUIT válido', path: ['cuit'] });
    }
  }
});

const formatCuit = (value = '') => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
};

const AREA_CODE_OPTIONS = [
  { label: 'Argentina (+54)', value: '+54' },
  { label: 'Brasil (+55)', value: '+55' },
  { label: 'Paraguay (+595)', value: '+595' },
];

const formatPhoneInput = (value = '') => value.replace(/[^0-9\s()-]/g, '');

export default function LoginScreen() {
  const nav  = useNavigation();
  const route = useRoute();
  const routeMode = route?.params?.mode;
  const { login, register, isLogged, isClub, ready } = useAuth();

  // 'login' | 'register' | 'success'
  const [mode, setMode] = useState(() => (routeMode === 'register' ? 'register' : 'login'));
  const [busy, setBusy] = useState(false);
  const [err,  setErr]  = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showAreaOptions, setShowAreaOptions] = useState(false);

  const resolver = useMemo(() => {
    switch (mode) {
      case 'login':    return zodResolver(loginSchema);
      case 'register': return zodResolver(registerSchema);
      default:         return zodResolver(loginSchema);
    }
  }, [mode]);

  const {
    control, handleSubmit, reset, watch,
    formState: { errors }
  } = useForm({
    resolver,
    defaultValues: {
      // login
      email: '', password: '',
      // register
      nombre: '', apellido: '', telefono: '', codigo_area: '+54', rol: 'deportista', nombre_club: '', cuit: '',
    },
  });

  const rol = watch('rol');

  // Limpiar estado al cambiar de modo
  useEffect(() => {
    setErr('');
    if (mode !== 'success') {
      setSuccessMessage('');
    }
    if (mode === 'login') {
      reset({ email: '', password: '' });
    } else if (mode === 'register') {
      reset({
        nombre: '',
        apellido: '',
        email: '',
        password: '',
        telefono: '',
        codigo_area: '+54',
        rol: 'deportista',
        nombre_club: '',
        cuit: '',
      });
    }
    setShowAreaOptions(false);
  }, [mode, reset]);

  useEffect(() => {
    if (routeMode === 'register') {
      setMode('register');
    } else if (routeMode === 'login') {
      setMode('login');
    }
  }, [routeMode]);

  const submitLogin = async ({ email, password }) => {
    setBusy(true); setErr('');
    try {
      await login({ email, password });
    } catch (e) {
      setErr(e.message || 'Credenciales inválidas');
    } finally { setBusy(false); }
  };

  const submitRegister = async (data) => {
    setBusy(true); setErr('');
    try {
      await register(data);
      setSuccessMessage('Tu cuenta fue creada correctamente.');
      setMode('success');
    } catch (e) {
      setErr(e.message || 'No se pudo registrar');
    } finally { setBusy(false); }
  };

  const toggleMode = () => setMode(m => (m === 'login' ? 'register' : 'login'));

  const goLogin  = () => setMode('login');

  const safeBack = () => {
    if (nav.canGoBack && nav.canGoBack()) nav.goBack();
    else nav.reset({ index: 0, routes: [{ name: 'Landing' }] });
  };

  useEffect(() => {
    if (!ready || !isLogged) return;
    const destination = isClub ? 'Dashboard' : 'WorkInProgress';
    nav.reset({ index: 0, routes: [{ name: destination }] });
  }, [ready, isLogged, isClub, nav]);

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
              success:  'Cuenta creada',
            }[mode]}
          </Text>

          <Text className="text-mc-textDim mb-8 text-center">
            {{
              login:    'Ingresá tus datos para continuar',
              register: 'Completá tus datos para unirte a meClub',
              success:  'Tu registro fue exitoso, ya podés iniciar sesión.',
            }[mode]}
          </Text>

          <View className="gap-4 max-h-[70vh] overflow-y-auto">
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
                  name="apellido"
                  render={({ field: { onChange, value } }) => (
                    <View>
                      <Text className="text-mc-textDim mb-2">Apellido</Text>
                      <TextInput
                        className="bg-mc-surface text-mc-text rounded-xl2 px-4 py-3 border border-mc-stroke"
                        placeholder="Tu apellido"
                        placeholderTextColor="#7789a6"
                        value={value}
                        onChangeText={onChange}
                      />
                      {errors.apellido && <Text className="text-red-400 mt-1">{errors.apellido.message}</Text>}
                    </View>
                  )}
                />

                <View>
                  <Text className="text-mc-textDim mb-2">Teléfono</Text>
                  <View className="flex-row gap-3">
                    <Controller
                      control={control}
                      name="codigo_area"
                      render={({ field: { onChange, value } }) => (
                        <View className="flex-1">
                          <Pressable
                            onPress={() => setShowAreaOptions((prev) => !prev)}
                            className="bg-mc-surface text-mc-text rounded-xl2 px-4 py-3 border border-mc-stroke"
                          >
                            <Text className="text-mc-text">
                              {AREA_CODE_OPTIONS.find((option) => option.value === value)?.label ?? 'Seleccioná'}
                            </Text>
                          </Pressable>
                          {showAreaOptions && (
                            <View className="mt-2 rounded-xl2 border border-mc-stroke bg-mc-surface">
                              {AREA_CODE_OPTIONS.map((option) => {
                                const isSelected = option.value === value;
                                return (
                                  <Pressable
                                    key={option.value}
                                    onPress={() => {
                                      onChange(option.value);
                                      setShowAreaOptions(false);
                                    }}
                                    className={`px-4 py-2 ${isSelected ? 'bg-white/10' : ''}`}
                                  >
                                    <Text className="text-mc-text">{option.label}</Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          )}
                          {errors.codigo_area && (
                            <Text className="text-red-400 mt-1">{errors.codigo_area.message}</Text>
                          )}
                        </View>
                      )}
                    />

                    <Controller
                      control={control}
                      name="telefono"
                      render={({ field: { onChange, value } }) => (
                        <View className="flex-[1.2]">
                          <TextInput
                            className="bg-mc-surface text-mc-text rounded-xl2 px-4 py-3 border border-mc-stroke"
                            placeholder="Tu teléfono"
                            placeholderTextColor="#7789a6"
                            keyboardType="phone-pad"
                            value={value}
                            onChangeText={(text) => onChange(formatPhoneInput(text))}
                          />
                          {errors.telefono && (
                            <Text className="text-red-400 mt-1">{errors.telefono.message}</Text>
                          )}
                        </View>
                      )}
                    />
                  </View>
                </View>

                <Controller
                  control={control}
                  name="rol"
                  render={({ field: { onChange, value } }) => (
                    <View>
                      <Text className="text-mc-textDim mb-2">Soy un...</Text>
                      <View className="flex-row gap-3 items-center">
                        <Pressable
                          onPress={() => onChange('deportista')}
                          className={`px-4 py-2 rounded-xl2 border ${value === 'deportista' ? 'border-mc-info shadow-[0_0_14px_rgba(76,201,240,0.25)]' : 'border-mc-stroke'}`}
                        >
                          <Text className="text-mc-text">Jugador/Deportista</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => onChange('club')}
                          className={`px-4 py-2 rounded-xl2 border ${value === 'club' ? 'border-mc-info shadow-[0_0_14px_rgba(76,201,240,0.25)]' : 'border-mc-stroke'}`}
                        >
                          <Text className="text-mc-text">Club</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                />

                {rol === 'club' && (
                  <>
                    <Controller
                      control={control}
                      name="nombre_club"
                      render={({ field: { onChange, value } }) => (
                        <View>
                          <Text className="text-mc-textDim mb-2">Nombre del club</Text>
                          <TextInput
                            className="bg-mc-surface text-mc-text rounded-xl2 px-4 py-3 border border-mc-stroke"
                            placeholder="Mi Club Deportivo"
                            placeholderTextColor="#7789a6"
                            value={value}
                            onChangeText={onChange}
                          />
                          {errors.nombre_club && (
                            <Text className="text-red-400 mt-1">{errors.nombre_club.message}</Text>
                          )}
                        </View>
                      )}
                    />

                    <Controller
                      control={control}
                      name="cuit"
                      render={({ field: { onChange, value } }) => (
                        <View>
                          <Text className="text-mc-textDim mb-2">CUIT</Text>
                          <TextInput
                            className="bg-mc-surface text-mc-text rounded-xl2 px-4 py-3 border border-mc-stroke"
                            placeholder="20-12345678-3"
                            placeholderTextColor="#7789a6"
                            keyboardType="numeric"
                            value={value}
                            onChangeText={(text) => onChange(formatCuit(text))}
                          />
                          {errors.cuit && <Text className="text-red-400 mt-1">{errors.cuit.message}</Text>}
                        </View>
                      )}
                    />
                  </>
                )}
              </>
            )}

            {/* LOGIN / REGISTER: email */}
            {(mode === 'login' || mode === 'register') && (
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
                      onSubmitEditing={mode === 'login' ? () => handleSubmit(submitLogin)() : undefined}
                    />
                    {errors.password && <Text className="text-red-400 mt-1">{errors.password.message}</Text>}
                  </View>
                )}
              />
            )}

            {!!err &&  <Text className="text-red-400">{err}</Text>}

            {/* CTA principal */}
            {(mode === 'login' || mode === 'register') && (
              <Pressable
                disabled={busy}
                onPress={() => {
                  Keyboard.dismiss();
                  handleSubmit(
                    mode === 'login' ? submitLogin : submitRegister
                  )();
                }}
                className="bg-mc-primary rounded-xl2 py-3 items-center mt-2
                           transition-transform duration-150 hover:-translate-y-0.5
                           hover:shadow-[0_12px_28px_rgba(43,130,128,0.35)]
                           active:opacity-95"
              >
                {busy ? <ActivityIndicator color="#fff" /> :
                  <Text className="text-white font-semibold">
                    {{ login: 'Entrar', register: 'Crear cuenta' }[mode]}
                  </Text>
                }
              </Pressable>
            )}

            {mode === 'success' && (
              <View className="items-center gap-4">
                <Text className="text-emerald-400 text-center">{successMessage}</Text>
                <Pressable
                  onPress={goLogin}
                  className="bg-mc-primary rounded-xl2 py-3 px-6 items-center
                             transition-transform duration-150 hover:-translate-y-0.5
                             hover:shadow-[0_12px_28px_rgba(43,130,128,0.35)]
                             active:opacity-95"
                >
                  <Text className="text-white font-semibold">Volver a Iniciar sesión</Text>
                </Pressable>
              </View>
            )}

            {/* Links secundarios */}
            {mode === 'login' && (
              <View className="mt-3 items-center gap-2">
                <Pressable onPress={toggleMode}><Text className="text-mc-textDim underline">¿No tenés cuenta? Crear cuenta</Text></Pressable>
              </View>
            )}
            {mode === 'register' && (
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
