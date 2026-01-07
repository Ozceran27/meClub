import React from 'react';
import { View, Text } from 'react-native';

export default function ScreenHeader({ title, subtitle, className = '' }) {
  return (
    <View className={`py-6 ${className}`.trim()}>
      <Text className="text-white text-[36px] font-extrabold tracking-tight" accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text className="text-white/60 mt-1">{subtitle}</Text> : null}
    </View>
  );
}
