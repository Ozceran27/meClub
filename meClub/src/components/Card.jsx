import React from 'react';
import { View } from 'react-native';

/**
 * Reusable container that applies the default dashboard card styles.
 *
 * Adds background, padding, rounded corners and shadow. Extra Tailwind
 * classes can be provided via `className` to further customize the card.
 */
export default function Card({ className = '', children, style, opaque = false, ...rest }) {
  const combinedStyle = [
    { overflow: 'visible' },
    style,
  ].filter(Boolean);
  const backgroundClass = opaque ? 'bg-[#0F172A]' : 'bg-[#0F172A]/90';

  return (
    <View
      className={`${backgroundClass} rounded-2xl p-5 shadow-card ${className}`}
      style={combinedStyle}
      {...rest}
    >
      {children}
    </View>
  );
}
