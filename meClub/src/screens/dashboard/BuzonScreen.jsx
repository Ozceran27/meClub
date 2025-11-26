import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/Card';
import { deleteInbox, getInbox, markInboxRead } from '../../lib/api';

const PAGE_LIMIT = 40;

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch (error) {
    return date.toISOString();
  }
}

function MessageBadge({ isRead }) {
  const text = isRead ? 'Leído' : 'Nuevo';
  const styles = isRead
    ? 'bg-emerald-500/10 border-emerald-400/40'
    : 'bg-cyan-500/10 border-cyan-400/40';
  const textColor = isRead ? 'text-emerald-50' : 'text-cyan-50';
  return (
    <View className={`rounded-full px-3 py-[6px] border ${styles}`}>
      <Text className={`text-[12px] font-semibold ${textColor}`} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

function TypePill({ type }) {
  if (!type) return null;
  return (
    <View className="rounded-full px-3 py-[6px] bg-white/5 border border-white/10">
      <Text className="text-[12px] font-semibold text-white/80">
        {String(type).replace(/_/g, ' ')}
      </Text>
    </View>
  );
}

export default function BuzonScreen() {
  const [messages, setMessages] = useState([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [error, setError] = useState('');

  const sortedMessages = useMemo(() => {
    return [...messages].sort((a, b) => {
      const dateA = new Date(a?.createdAt || a?.messageCreatedAt || 0).getTime();
      const dateB = new Date(b?.createdAt || b?.messageCreatedAt || 0).getTime();
      return dateB - dateA;
    });
  }, [messages]);

  const loadInbox = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getInbox({ page, limit: PAGE_LIMIT });
      const data = Array.isArray(result?.inbox) ? result.inbox : [];
      setMessages(data);
      const totalItems = Number.isFinite(result?.total)
        ? result.total
        : page * PAGE_LIMIT + (data.length === PAGE_LIMIT ? 1 : 0);
      setTotal(totalItems);
      setHasMore(page * PAGE_LIMIT < totalItems);
    } catch (err) {
      setError(err?.message || 'No se pudo cargar el buzón');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  const openMessage = useCallback(
    async (message) => {
      if (!message) return;
      setSelectedMessage(message);
      if (message.isRead) return;

      try {
        await markInboxRead(message.inboxId);
        setMessages((prev) =>
          prev.map((item) =>
            item.inboxId === message.inboxId
              ? { ...item, isRead: true, readAt: new Date().toISOString() }
              : item
          )
        );
        setSelectedMessage((prev) =>
          prev && prev.inboxId === message.inboxId
            ? { ...prev, isRead: true, readAt: new Date().toISOString() }
            : prev
        );
      } catch (err) {
        setError(err?.message || 'No se pudo marcar como leído');
      }
    },
    []
  );

  const handleDelete = useCallback(() => {
    if (!selectedMessage) return;
    Alert.alert(
      'Eliminar mensaje',
      'Esta acción no se puede deshacer. ¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteInbox(selectedMessage.inboxId);
              setSelectedMessage(null);
              setMessages((prev) => prev.filter((item) => item.inboxId !== selectedMessage.inboxId));
              const nextTotal = total > 0 ? total - 1 : 0;
              setTotal(nextTotal);
              setHasMore(page * PAGE_LIMIT < nextTotal);
              if (messages.length === 1 && page > 1) {
                setPage((prev) => Math.max(1, prev - 1));
              }
            } catch (err) {
              setError(err?.message || 'No se pudo eliminar el mensaje');
            }
          },
        },
      ]
    );
  }, [page, selectedMessage, total, messages.length]);

  const closeModal = useCallback(() => setSelectedMessage(null), []);

  const pagination = (
    <View className="flex-row justify-between items-center mt-4">
      <Pressable
        onPress={() => setPage((prev) => Math.max(1, prev - 1))}
        disabled={page === 1 || loading}
        className={`flex-row items-center gap-2 px-4 py-3 rounded-xl border border-white/10 ${
          page === 1 || loading ? 'opacity-40' : 'bg-white/5'
        }`}
      >
        <Ionicons name="chevron-back" size={18} color="#E2E8F0" />
        <Text className="text-white font-semibold">Anterior</Text>
      </Pressable>
      <Text className="text-white/70 text-sm">Página {page}</Text>
      <Pressable
        onPress={() => setPage((prev) => prev + 1)}
        disabled={!hasMore || loading}
        className={`flex-row items-center gap-2 px-4 py-3 rounded-xl border border-white/10 ${
          !hasMore || loading ? 'opacity-40' : 'bg-white/5'
        }`}
      >
        <Text className="text-white font-semibold">Siguiente</Text>
        <Ionicons name="chevron-forward" size={18} color="#E2E8F0" />
      </Pressable>
    </View>
  );

  return (
    <View className="flex-1 bg-[#0A0F1D] px-6 py-4">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-white text-2xl font-semibold mb-2">Buzón</Text>
        <Text className="text-white/70 mb-4">
          Revisa tus notificaciones y mensajes del club.
        </Text>

        {error ? (
          <Card className="border border-rose-400/40">
            <Text className="text-rose-200">{error}</Text>
          </Card>
        ) : null}

        {loading ? (
          <View className="mt-8 items-center">
            <ActivityIndicator size="large" color="#38BDF8" />
            <Text className="text-white/70 mt-3">Cargando mensajes...</Text>
          </View>
        ) : null}

        {!loading && sortedMessages.length === 0 ? (
          <Card>
            <View className="items-center py-6">
              <Ionicons name="mail-open-outline" size={48} color="#94A3B8" />
              <Text className="text-white font-semibold mt-4">No hay mensajes</Text>
              <Text className="text-white/60 mt-1 text-center">Los mensajes nuevos aparecerán aquí.</Text>
            </View>
          </Card>
        ) : null}

        <View className="mt-2 flex-col gap-3">
          {sortedMessages.map((message) => (
            <Pressable key={message.inboxId} onPress={() => openMessage(message)}>
              <Card
                className={`border ${message.isRead ? 'border-white/10' : 'border-cyan-400/30'} bg-gradient-to-br from-[#0F172A]/90 to-[#0B1224]/90`}
              >
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 gap-2">
                    <Text className="text-white text-lg font-semibold" numberOfLines={1}>
                      {message.title || 'Sin título'}
                    </Text>
                    <Text className="text-white/70 text-sm" numberOfLines={2}>
                      {message.content || 'Sin contenido'}
                    </Text>
                    <View className="flex-row items-center gap-3 mt-2">
                      <TypePill type={message.type} />
                      <Text className="text-white/50 text-sm" numberOfLines={1}>
                        {formatDate(message.createdAt || message.messageCreatedAt)}
                      </Text>
                    </View>
                  </View>
                  <MessageBadge isRead={message.isRead} />
                </View>
              </Card>
            </Pressable>
          ))}
        </View>

        {(hasMore || page > 1) && pagination}
      </ScrollView>

      <Modal
        visible={!!selectedMessage}
        transparent
        animationType="slide"
        onRequestClose={closeModal}
      >
        <View className="flex-1 bg-black/60 items-center justify-center px-4">
          <View className="w-full max-w-2xl rounded-2xl bg-[#0B1224] border border-white/10 p-5">
            <View className="flex-row justify-between items-start mb-4">
              <View className="flex-1 pr-4 gap-2">
                <Text className="text-white text-xl font-semibold" numberOfLines={2}>
                  {selectedMessage?.title || 'Mensaje'}
                </Text>
                <View className="flex-row items-center gap-3">
                  <TypePill type={selectedMessage?.type} />
                  <MessageBadge isRead={selectedMessage?.isRead} />
                </View>
                <Text className="text-white/60 text-sm">
                  {formatDate(selectedMessage?.createdAt || selectedMessage?.messageCreatedAt)}
                </Text>
              </View>
              <Pressable
                onPress={closeModal}
                className="h-10 w-10 rounded-full items-center justify-center bg-white/5 border border-white/10"
              >
                <Ionicons name="close" size={18} color="#E2E8F0" />
              </Pressable>
            </View>

            <Card className="bg-white/5 border border-white/10">
              <Text className="text-white/90 leading-6">
                {selectedMessage?.content || 'Sin contenido disponible'}
              </Text>
            </Card>

            <View className="flex-row justify-end gap-3 mt-4">
              <Pressable
                onPress={handleDelete}
                className="flex-row items-center gap-2 px-4 py-3 rounded-xl border border-rose-400/40 bg-rose-500/10"
              >
                <Ionicons name="trash-outline" size={18} color="#FCA5A5" />
                <Text className="text-rose-200 font-semibold">Eliminar</Text>
              </Pressable>
              <Pressable
                onPress={closeModal}
                className="flex-row items-center gap-2 px-4 py-3 rounded-xl border border-white/10 bg-white/5"
              >
                <Ionicons name="checkmark-outline" size={18} color="#E2E8F0" />
                <Text className="text-white font-semibold">Cerrar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
