import { View, Text, Image } from 'react-native';

export default function WorkInProgressScreen() {
  return (
    <View className="flex-1 bg-mc-bg items-center justify-center">
      <Image
        source={require('../../assets/icon.png')}
        className="w-24 h-24 mb-4"
        resizeMode="contain"
      />
      <Text className="text-mc-text text-xl">Estamos trabajando</Text>
    </View>
  );
}
