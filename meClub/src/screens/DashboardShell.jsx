// src/screens/DashboardShell.jsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../features/auth/useAuth';

const brand = {
  bg:    '#0e131f',
  panel: '#111a2a',
  panel2:'#0f1826',   // más “opaco”, combina con sidebar/topbar
  line:  '#0b1220',
  ink:   '#dbe7ff',
  mute:  '#8ca0b3',
  aqua:  '#38bdf8',
  green: '#26a69a',
  gold:  '#f2b83f',
};

const menu = [
  { key: 'home',       label: 'Inicio' },
  { key: 'inbox',      label: 'Buzón' },
  { key: 'courts',     label: 'Mis Canchas' },
  { key: 'bookings',   label: 'Reservas' },
  { key: 'hours',      label: 'Horarios' },
  { key: 'prices',     label: 'Tarifas' },
  { key: 'recordings', label: 'Grabaciones' },
  { key: 'events',     label: 'Eventos' },
  { key: 'team',       label: 'meEquipo' },
  { key: 'ranking',    label: 'Ranking' },
  { key: 'reconcile',  label: 'Conciliar' },
  { key: 'settings',   label: 'Ajustes' },
  { key: 'support',    label: 'Soporte' },
];

function Pill({ color, children }) {
  return (
    <View style={{
      backgroundColor: `${color}22`,
      borderColor: `${color}55`,
      borderWidth: 1,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 999
    }}>
      <Text style={{ color, fontWeight:'700' }}>{children}</Text>
    </View>
  );
}

export default function DashboardShell() {
  const { user, logout } = useAuth();
  const nav = useNavigation();
  const [active, setActive] = useState('home');

  const firstName = useMemo(() => {
    const full = String(user?.nombre ?? user?.name ?? '').trim();
    return full.split(' ')[0] || 'Club';
  }, [user?.nombre, user?.name]);

  const today = useMemo(() => {
    try {
      return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    } catch { return ''; }
  }, []);

  const handleLogout = async () => {
    await logout();
    // En nativo: volvemos al Login; en Web, logout ya redirige /login
    try { nav.reset({ index: 0, routes: [{ name: 'Login' }] }); } catch {}
  };

  return (
    <View style={{ flex: 1, backgroundColor: brand.bg }}>
      {/* LAYOUT: sidebar + main */}
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* SIDEBAR */}
        <View style={{
          width: 260,
          backgroundColor: brand.panel2,
          paddingTop: 18,
          paddingBottom: 12,
          borderRightColor: brand.line,
          borderRightWidth: 1
        }}>
          {/* Branding / club */}
          <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
            <Text style={{ color: brand.ink, fontSize: 18, fontWeight: '900', letterSpacing: .3 }}>
              {user?.clubNombre || 'Panel del Club'}
            </Text>
          </View>

          {/* Items */}
          <ScrollView contentContainerStyle={{ paddingVertical: 6 }}>
            {menu.map((m) => {
              const isActive = active === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => setActive(m.key)}
                  style={({ hovered }) => ({
                    paddingVertical: 12,
                    paddingLeft: 18,
                    paddingRight: 14,
                    marginHorizontal: 8,
                    marginVertical: 4,
                    borderRadius: 12,
                    backgroundColor: isActive ? '#121a28' : hovered ? '#0f1624' : 'transparent',
                    borderWidth: isActive ? 1 : 0,
                    borderColor: isActive ? '#182336' : 'transparent'
                  })}
                >
                  <Text style={{ color: isActive ? brand.ink : brand.mute, fontSize: 15, fontWeight: isActive ? '700' : '600' }}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}

            {/* Cerrar sesión */}
            <Pressable
              onPress={handleLogout}
              style={({ hovered }) => ({
                marginTop: 14,
                paddingVertical: 12,
                paddingLeft: 18,
                paddingRight: 14,
                marginHorizontal: 8,
                borderRadius: 12,
                backgroundColor: hovered ? '#0f1624' : 'transparent',
                borderWidth: 1,
                borderColor: '#1f2b40'
              })}
            >
              <Text style={{ color: '#e87979', fontSize: 15, fontWeight:'700' }}>Cerrar sesión</Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* MAIN */}
        <View style={{ flex: 1 }}>
          {/* TOPBAR */}
          <View style={{
            height: 64,
            backgroundColor: brand.panel2, // mismo color que sidebar
            borderBottomColor: brand.line,
            borderBottomWidth: 1,
            justifyContent: 'center',
            paddingHorizontal: 24
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: brand.ink, fontSize: 28, fontWeight: '800' }}>
                  Hola, {firstName}
                </Text>
                <Text style={{ color: brand.mute, marginTop: 2, fontSize: 12 }}>
                  {today}
                </Text>
              </View>
              {/* Acciones rápidas futuras */}
              <View style={{ flexDirection:'row', gap: 10 }}>
                <Pill color={brand.green}>Club</Pill>
              </View>
            </View>
          </View>

          {/* CONTENIDO */}
          <ScrollView style={{ flex:1 }} contentContainerStyle={{ padding: 22 }}>
            {/* Grid de cards (más opacas) */}
            <View style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: 16
            }}>
              {[
                { title: 'Reservas de hoy', value: '12', hint: '+2 vs ayer' },
                { title: 'Canchas activas', value: '5/8', hint: '3 libres' },
                { title: 'Ingresos (mes)', value: '$ 1.2M', hint: 'Proyección +8%' },
                { title: 'Eventos', value: '2', hint: 'Este fin de semana' },
              ].map((c, i) => (
                <View key={i} style={{
                  width: 300,
                  backgroundColor: brand.panel2,
                  borderColor: brand.line,
                  borderWidth: 1,
                  borderRadius: 14,
                  padding: 16
                }}>
                  <Text style={{ color: brand.mute, fontSize: 12, marginBottom: 6 }}>{c.title}</Text>
                  <Text style={{ color: brand.ink, fontSize: 26, fontWeight: '900' }}>{c.value}</Text>
                  <Text style={{ color: brand.mute, fontSize: 12, marginTop: 6 }}>{c.hint}</Text>
                </View>
              ))}
            </View>

            {/* Panel grande (placeholder) */}
            <View style={{
              marginTop: 18,
              backgroundColor: brand.panel2,
              borderColor: brand.line,
              borderWidth: 1,
              borderRadius: 14,
              padding: 18
            }}>
              <Text style={{ color: brand.ink, fontSize: 18, fontWeight:'800', marginBottom: 8 }}>
                Próximos pasos
              </Text>
              <Text style={{ color: brand.mute }}>
                Aquí renderizaremos el contenido de cada sección (según el item activo del sidebar).
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}
