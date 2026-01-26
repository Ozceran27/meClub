import React from 'react';
import { Modal, Platform, ScrollView, View } from 'react-native';

const DEFAULT_OVERLAY_CLASSNAME = 'bg-black/60';
const DEFAULT_CONTENT_CLASSNAME = 'items-center justify-center';
const DEFAULT_CONTAINER_CLASSNAME = 'w-full max-w-3xl max-h-[90vh]';
const DEFAULT_SCROLL_CLASSNAME = 'w-full max-h-[90vh]';

export default function ModalContainer({
  visible,
  onRequestClose,
  animationType = 'fade',
  overlayClassName = DEFAULT_OVERLAY_CLASSNAME,
  contentClassName = DEFAULT_CONTENT_CLASSNAME,
  containerClassName = DEFAULT_CONTAINER_CLASSNAME,
  children,
}) {
  const overlayClasses = [
    'flex-1 px-4 items-center justify-center',
    Platform.OS === 'web' ? 'fixed inset-0' : null,
    overlayClassName,
    contentClassName,
  ]
    .filter(Boolean)
    .join(' ');
  const containerClasses = [containerClassName].filter(Boolean).join(' ');
  const scrollClasses = [DEFAULT_SCROLL_CLASSNAME].filter(Boolean).join(' ');

  return (
    <Modal
      transparent
      visible={visible}
      animationType={animationType}
      onRequestClose={onRequestClose}
    >
      <View className={overlayClasses}>
        <View className={containerClasses}>
          {Platform.OS === 'web' ? (
            <View className={`${scrollClasses} overflow-y-auto`}>{children}</View>
          ) : (
            <ScrollView className={scrollClasses} contentContainerStyle={{ paddingBottom: 24 }}>
              {children}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
