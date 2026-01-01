import React from 'react';
import { Modal, View } from 'react-native';

const DEFAULT_OVERLAY_CLASSNAME = 'bg-black/60';
const DEFAULT_CONTENT_CLASSNAME = 'items-center justify-center';
const DEFAULT_CONTAINER_CLASSNAME = 'w-full max-w-3xl max-h-[90vh]';

export default function ModalContainer({
  visible,
  onRequestClose,
  animationType = 'fade',
  overlayClassName = DEFAULT_OVERLAY_CLASSNAME,
  contentClassName = DEFAULT_CONTENT_CLASSNAME,
  containerClassName = DEFAULT_CONTAINER_CLASSNAME,
  children,
}) {
  const overlayClasses = ['flex-1 px-4', overlayClassName, contentClassName]
    .filter(Boolean)
    .join(' ');
  const containerClasses = [containerClassName].filter(Boolean).join(' ');

  return (
    <Modal
      transparent
      visible={visible}
      animationType={animationType}
      onRequestClose={onRequestClose}
    >
      <View className={overlayClasses}>
        <View className={containerClasses}>{children}</View>
      </View>
    </Modal>
  );
}
