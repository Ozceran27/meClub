import { View, Text } from 'react-native';

export default function DashboardShell() {
  // Próximo paso: Sidebar + Topbar + Contenido (cards como en Template 4.png)
  return (
    <View className="flex-1 bg-mc-bg">
      <View className="p-6">
        <Text className="text-mc-text text-2xl font-bold">Dashboard</Text>
        <Text className="text-mc-textDim mt-2">Estructura base lista. Próximo: maquetar Sidebar y tarjetas.</Text>
      </View>
    </View>
  );
}