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
  const badgeVariant = badgeText === 'PRO' ? 'pro' : badgeText === 'ADV' ? 'adv' : 'default';
  const badgeContent = isBadgeElement
    ? computedBadge
    : badgeText
      ? (
        <View
          className={`rounded-full px-2 py-[2px] border ${
            badgeVariant === 'pro'
              ? 'bg-amber-500/20 border-amber-400/50 hover:bg-amber-500/30 hover:border-amber-300/70'
              : badgeVariant === 'adv'
                ? 'bg-sky-500/20 border-sky-400/50 hover:bg-sky-500/30 hover:border-sky-300/70'
                : 'bg-amber-500/20 border-amber-400/50 hover:bg-amber-500/30 hover:border-amber-300/70'
          }`}
          accessible
          accessibilityLabel={
            badgeVariant === 'pro'
              ? 'Funcionalidad PRO'
              : badgeVariant === 'adv'
                ? 'Funcionalidad ADV'
                : `Etiqueta ${badgeText}`
          }
          aria-label={
            badgeVariant === 'pro'
              ? 'Funcionalidad PRO'
              : badgeVariant === 'adv'
                ? 'Funcionalidad ADV'
                : `Etiqueta ${badgeText}`
          }
        >
          <Text
            className={`text-[10px] font-semibold ${
              badgeVariant === 'pro'
                ? 'text-amber-300'
                : badgeVariant === 'adv'
                  ? 'text-sky-100'
                  : 'text-amber-300'
            }`}
          >
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
        disabled ? 'opacity-99' : ''
      } ${className}`.trim()}
    >
      <Ionicons name={icon} size={iconSize} color="#0A0F1D" />
      <Text className="text-[#0A0F1D] text-sm font-semibold flex-1">{label}</Text>
      {badgeContent}
    </Pressable>
  );
}
