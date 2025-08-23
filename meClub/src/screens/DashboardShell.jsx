// src/DashboardShell.jsx
import { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from './features/auth/useAuth';

const brand = {
  app:   '#0e131f', // fondo app
  panel: '#0f1624', // sidebar/topbar/cards
  edge:  '#142036', // bordecito suave
  ink:   '#dbe7ff',
  mute:  '#8ca0b3',
  aqua:  '#38bdf8',
  green: '#2b8280',
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
      backgroundColor: `${color}1f`,
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
  const { user } = useAuth();
  const navigate = useNavigate();
  const { search } = useLocation();
  const initial = new URLSearchParams(search).get('tab') || 'home';
  const [active, setActive] = useState(initial);

  // Navegación
  const go = (key) => {
    setActive(key);
    navigate(`/dashboard?tab=${key}`, { replace: false });
  };

  const today = useMemo(() => {
    try {
      return new Date().toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    } catch { return ''; }
  }, []);

  const firstName = useMemo(() => {
    const n = user?.nombre || user?.name || user?.username || 'Usuario';
    return String(n).split(' ')[0];
  }, [user]);

  const clubName = user?.clubNombre || user?.club || 'Club Centro';

  return (
    <View style={{ flex: 1, backgroundColor: brand.app }}>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        {/* SIDEBAR */}
        <View style={{ width: 260, backgroundColor: brand.panel, paddingTop: 18, paddingBottom: 12 }}>
          {/* Marca */}
          <View style={{ paddingHorizontal: 18, paddingBottom: 14 }}>
            <Text style={{ color: brand.ink, fontSize: 18, fontWeight: '900', letterSpacing: .3 }}>
              {clubName}
            </Text>
          </View>

          {/* Items */}
          <ScrollView contentContainerStyle={{ paddingVertical: 6 }}>
            {menu.map((m) => {
              const isActive = active === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => go(m.key)}
                  style={({ hovered }) => ({
                    position: 'relative',
                    paddingVertical: 12,
                    paddingLeft: 24,
                    paddingRight: 16,
                    marginHorizontal: 8,
                    marginVertical: 4,
                    borderRadius: 12,
                    backgroundColor: isActive ? '#101a2b' : hovered ? '#0e1827' : 'transparent',
                    borderLeftWidth: 3,
                    borderLeftColor: isActive ? brand.aqua : 'transparent',
                    shadowColor: hovered || isActive ? brand.aqua : 'transparent',
                    shadowOpacity: hovered ? 0.15 : (isActive ? 0.18 : 0),
                    shadowRadius: hovered ? 5 : (isActive ? 6 : 0),
                  })}
                >
                  <Text style={{ color: isActive ? brand.ink : brand.mute, fontSize: 15, fontWeight: isActive ? '800' : '600' }}>
                    {m.label}
                  </Text>
                </Pressable>
              );
            })}

            {/* Cerrar sesión → usa ruta /logout */}
            <Pressable
              onPress={() => navigate('/logout')}
              style={({ hovered }) => ({
                marginTop: 12,
                paddingVertical: 12,
                paddingHorizontal: 16,
                marginHorizontal: 8,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: brand.edge,
                backgroundColor: hovered ? '#0e1827' : 'transparent'
              })}
            >
              <Text style={{ color: '#e87979', fontSize: 15, fontWeight:'700' }}>Cerrar sesión</Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* MAIN */}
        <View style={{ flex: 1 }}>
          {/* TOPBAR */}
          <View style={{ height: 72, justifyContent: 'center', paddingHorizontal: 24, backgroundColor: brand.panel }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View>
                <Text style={{ color: brand.ink, fontSize: 30, fontWeight: '900', letterSpacing:.2 }}>
                  {`Hola, ${firstName}`}
                </Text>
                <Text style={{ color: brand.mute, marginTop: 2 }}>{today}</Text>
              </View>
              {/* Avatar */}
              <Pressable onPress={() => navigate('/logout')}>
                <View style={{
                  width: 40, height: 40, borderRadius: 999,
                  backgroundColor: '#223145',
                  alignItems: 'center', justifyContent: 'center',
                  borderColor: '#2c3c53', borderWidth: 1
                }}>
                  <Text style={{ color: brand.ink, fontWeight: '800' }}>
                    {(firstName || 'U').slice(0,1).toUpperCase()}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          {/* CONTENT */}
          <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
            {/* FILA 1 */}
            <Row>
              <Card flex>
                <CardHeader title="MIS CANCHAS" color={brand.green} />
                <KPI big>
                  3 <Text style={{ color: brand.mute, fontWeight: '700' }}>disponibles</Text>
                </KPI>
                <GhostButton label="VER CANCHAS" />
              </Card>

              <Card flex>
                <CardHeader title="PRÓXIMO EVENTO" color={brand.gold} />
                <Text style={{ color: brand.ink, fontSize: 22, fontWeight: '800', marginTop: 6 }}>Torneo de Primavera</Text>
                <Text style={{ color: brand.mute, marginTop: 8 }}>martes, 30 de abril de 2024</Text>
              </Card>
            </Row>

            {/* FILA 2 */}
            <Row>
              <Card flex>
                <CardHeader title="RESERVAS" color={brand.aqua} />
                <KPI big>8 <Text style={{ color: brand.mute, fontWeight: '700' }}>hoy</Text></KPI>
                <Text style={{ color: brand.mute, marginTop: 6 }}>+24 esta semana</Text>
                <GhostButton label="VER RESERVAS" />
              </Card>

              <Card flex>
                <CardHeader title="ECONOMÍA" color={brand.green} />
                <KPI big>$14.520 <Text style={{ color: brand.mute, fontWeight: '700' }}>este mes</Text></KPI>
                <View style={{ height: 60, marginTop: 12, borderRadius: 10, backgroundColor: '#0e1b2b', borderWidth:1, borderColor: brand.edge }} />
              </Card>
            </Row>

            {/* FILA 3 */}
            <Row>
              <Card flex>
                <CardHeader title="EVENTOS" color={brand.aqua} />
                <View style={{ flexDirection: 'row', gap: 14, marginTop: 10, flexWrap:'wrap' }}>
                  <Pill color={brand.aqua}>meEquipo</Pill>
                  <Pill color={brand.ink}>Ranking</Pill>
                </View>
              </Card>

              <Card flex style={{ opacity: .85 }}>
                <CardHeader title="WIDGET LIBRE" color={brand.mute} />
              </Card>
            </Row>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

function Row({ children }) {
  return <View style={{ flexDirection: 'row', gap: 20, flexWrap:'wrap' }}>{children}</View>;
}

function Card({ children, style, flex }) {
  return (
    <View style={[{
      backgroundColor: brand.panel,
      borderColor: brand.edge,
      borderWidth: 1,
      borderRadius: 16,
      padding: 18,
      flexGrow: 1,
      flexBasis: 320
    }, flex ? { flex: 1 } : null, style]}>
      {children}
    </View>
  );
}

function CardHeader({ title, color }) {
  return (
    <Text style={{ color, fontWeight: '900', letterSpacing: 1.1, fontSize: 14 }}>{title}</Text>
  );
}

function KPI({ children, big }) {
  return (
    <Text style={{ color: brand.ink, fontWeight: '900', fontSize: big ? 32 : 18, marginTop: 8 }}>
      {children}
    </Text>
  );
}

function GhostButton({ label, onPress = () => {} }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ hovered }) => ({
        marginTop: 12,
        alignSelf: 'flex-start',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: brand.green,
        backgroundColor: hovered ? '#0f1d2e' : 'transparent',
        shadowColor: hovered ? brand.green : 'transparent',
        shadowOpacity: hovered ? 0.2 : 0,
        shadowRadius: hovered ? 6 : 0,
      })}
    >
      <Text style={{ color: brand.ink, fontWeight: '800' }}>{label}</Text>
    </Pressable>
  );
}
