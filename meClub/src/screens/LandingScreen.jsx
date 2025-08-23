import { View, Text, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

export default function LandingScreen() {
  const nav = useNavigation();

  return (
    <View className="flex-1 bg-mc-bg">
      {/* Fondo con gradientes superpuestos */}
      <LinearGradient
        colors={['#0e131f', '#0b101a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        className="absolute inset-0"
      />

      {/* halos decorativos */}
      <View className="absolute -top-20 -left-20 w-[380px] h-[380px] rounded-full"
            style={{ backgroundColor: 'rgba(102,194,255,0.10)', filter: 'blur(40px)' }} />
      <View className="absolute -bottom-24 -right-24 w-[420px] h-[420px] rounded-full"
            style={{ backgroundColor: 'rgba(43,130,128,0.10)', filter: 'blur(46px)' }} />

      <View className="flex-1 px-6 md:px-10 lg:px-16">
        {/* Header minimal (branding) */}
        <View className="py-6 flex-row items-center justify-between">
          <Text
            style={{ fontFamily: 'Inter_700Bold' }}
            className="text-mc-text text-2xl"
          >
            me<Text className="text-mc-warn">Club</Text>
          </Text>

          <Pressable
            onPress={() => nav.navigate('Login')}
            className="hidden md:flex bg-transparent px-4 py-2 rounded-xl border border-mc-stroke
                       transition-all duration-200 hover:border-mc-info hover:shadow-[0_0_24px_rgba(102,194,255,0.25)]
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-mc-info/60"
          >
            <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-mc-text">Iniciar sesión</Text>
          </Pressable>
        </View>

        {/* Hero */}
        <View className="flex-1 items-center justify-center">
          <View className="w-full max-w-5xl items-center md:flex-row md:items-start md:justify-between">
            {/* Texto principal */}
            <View className="w-full md:w-[55%]">
              <Text
                style={{ fontFamily: 'Inter_700Bold' }}
                className="text-4xl md:text-5xl lg:text-6xl text-mc-text leading-tight"
              >
                Reservas deportivas
                {'\n'}
                <Text className="text-mc-info">+ comunidad</Text> en un solo lugar
              </Text>

              <Text
                style={{ fontFamily: 'Inter_400Regular' }}
                className="text-mc-textDim mt-4 text-base md:text-lg"
              >
                Descubrí <Text className="text-mc-warn">canchas</Text> cercanas, coordiná con tu 
                <Text className="text-mc-warn"> equipo</Text> y seguí tus <Text className="text-mc-warn">partidos</Text>.
                — Tu juego, tus reglas — 
              </Text>

              {/* CTA */}
              <View className="flex-row gap-3 mt-8">
                <Pressable
                  onPress={() => nav.navigate('Login')}
                  className="bg-mc-primary px-6 py-3 rounded-xl2 shadow-soft
                             transition-transform duration-150 hover:-translate-y-0.5
                             hover:shadow-[0_12px_32px_rgba(43,130,128,0.35)]
                             focus:outline-none focus-visible:ring-2 focus-visible:ring-mc-primary/60"
                  android_ripple={{ color: 'rgba(43,130,128,0.2)' }}
                >
                  <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-white text-base">
                    Empezar ahora
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => nav.navigate('Login')}
                  className="
                    px-6 py-3 rounded-xl2 border border-mc-stroke
                    transition-all duration-200
                    hover:border-mc-info hover:shadow-[0_0_24px_rgba(102,194,255,0.25)]
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-mc-info/60
                  "
                >
                  <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-mc-text text-base">
                    Iniciar sesión
                  </Text>
                </Pressable>
              </View>

              {/* Bullets */}
              <View className="flex-row gap-6 mt-8 flex-wrap">
                <Row icon={<Ionicons name="time-outline" size={20} color="#66c2ff" />} text="Reservá en segundos" />
                <Row icon={<MaterialCommunityIcons name="account-group-outline" size={20} color="#66c2ff" />} text="Armá tu Equipo" />
                <Row icon={<MaterialCommunityIcons name="camera-outline" size={20} color="#dba741" />} text="Grabá con meCam" />
              </View>
            </View>

            {/* Card ilustrativa */}
            <View className="w-full md:w-[40%] mt-10 md:mt-0">
              <View className="bg-mc-surface rounded-xl2 p-5 border border-mc-stroke shadow-soft">
                <Text style={{ fontFamily: 'Inter_600SemiBold' }} className="text-mc-text mb-3">
                  Próximos pasos
                </Text>
                <View className="gap-3">
                  <Row icon={<Ionicons name="checkmark-circle" size={18} color="#2b8280" />} text="Elegí deporte y ubicación" />
                  <Row icon={<Ionicons name="checkmark-circle" size={18} color="#2b8280" />} text="Seleccioná horario disponible" />
                  <Row icon={<Ionicons name="checkmark-circle" size={18} color="#dba741" />} text="Confirmá y ¡a jugar!" />
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View className="py-6 items-center">
          <Text style={{ fontFamily: 'Inter_400Regular' }} className="text-mc-textDim">
            © {new Date().getFullYear()} meClub — Posadas, Misiones, Argentina.
          </Text>
        </View>
      </View>
    </View>
  );
}

function Row({ icon, text }) {
  return (
    <View className="flex-row items-center gap-2">
      {icon}
      <Text style={{ fontFamily: 'Inter_400Regular' }} className="text-mc-textDim">{text}</Text>
    </View>
  );
}
