import React from 'react';
import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ActionButton({
  label,
  icon,
  onPress,
  disabled = false,
  className = '',
  backgroundClassName = 'bg-mc-warn hover:bg-mc-warn/80',
  iconSize = 18,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center gap-2 rounded-2xl px-4 py-2 ${backgroundClassName} ${
        disabled ? 'opacity-50' : ''
      } ${className}`.trim()}
    >
      <Ionicons name={icon} size={iconSize} color="#0A0F1D" />
      <Text className="text-[#0A0F1D] text-sm font-semibold">{label}</Text>
    </Pressable>
  );
}
