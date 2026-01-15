import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ActionButton({
  label,
  icon,
  onPress,
  disabled = false,
  className = '',
  backgroundClassName = 'bg-mc-warn hover:bg-mc-warn/80',
  iconSize = 18,
  badge,
}) {
  const resolvedBackgroundClassName = backgroundClassName ?? 'bg-mc-warn hover:bg-mc-warn/80';
  const computedBadge = badge ?? null;
  const isBadgeElement = React.isValidElement(computedBadge);
  const badgeText = !isBadgeElement && computedBadge != null ? String(computedBadge) : '';
  const isProBadge = badgeText === 'PRO';
  const badgeContent = isBadgeElement
    ? computedBadge
    : badgeText
      ? (
        <View
          className={`rounded-full px-2 py-[2px] border ${
            isProBadge ? 'bg-amber-500/20 border-amber-400/50' : 'bg-rose-500/20 border-rose-400/60'
          }`}
          accessible
          accessibilityLabel={isProBadge ? 'Funcionalidad PRO' : `Etiqueta ${badgeText}`}
          aria-label={isProBadge ? 'Funcionalidad PRO' : `Etiqueta ${badgeText}`}
        >
          <Text className={`text-[10px] font-semibold ${isProBadge ? 'text-amber-300' : 'text-rose-100'}`}>
            {badgeText}
          </Text>
        </View>
      )
      : null;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`flex-row items-center gap-2 rounded-2xl px-4 py-2 ${resolvedBackgroundClassName} ${
        disabled ? 'opacity-50' : ''
      } ${className}`.trim()}
    >
      <Ionicons name={icon} size={iconSize} color="#0A0F1D" />
      <Text className="text-[#0A0F1D] text-sm font-semibold flex-1">{label}</Text>
      {badgeContent}
    </Pressable>
  );
}
