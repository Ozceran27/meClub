import React from 'react';
import { Text } from 'react-native';

/**
 * Title component for dashboard cards.
 *
 * Applies consistent typography styles and accepts a Tailwind color class
 * to customize the text color.
 */
export default function CardTitle({ children, colorClass }) {
  return (
    <Text className={`${colorClass} font-semibold tracking-widest text-[16px]`}>
      {children}
    </Text>
  );
}
