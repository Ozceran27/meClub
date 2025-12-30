import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Card from '../../components/Card';
import CardTitle from '../../components/CardTitle';

const FIELD_STYLES =
  'w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white focus:border-mc-warn';

const ACTION_BUTTON_STYLES =
  'flex-row items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2';

const SERVICE_CATALOG = [
  {
    id: 'svc-1',
    name: 'Clases de pádel',
    description: 'Clases grupales y privadas con entrenadores certificados.',
    price: '12000',
    duration: '60',
    active: true,
  },
  {
    id: 'svc-2',
    name: 'Alquiler de paletas',
    description: 'Paletas premium disponibles por turno.',
    price: '2500',
    duration: '30',
    active: true,
  },
  {
    id: 'svc-3',
    name: 'Servicio de guardado',
    description: 'Locker personal para socios.',
    price: '8000',
    duration: '30',
    active: false,
  },
];

const MEMBER_TYPES = [
  {
    id: 'type-1',
    name: 'Pleno',
    price: '35000',
    access: 'Acceso total + canchas preferenciales',
    active: true,
  },
  {
    id: 'type-2',
    name: 'Familiar',
    price: '52000',
    access: 'Hasta 4 miembros + beneficios compartidos',
    active: true,
  },
  {
    id: 'type-3',
    name: 'Social',
    price: '18000',
    access: 'Acceso limitado + eventos',
    active: false,
  },
];

const MEMBERS = [
  {
    id: 'mem-1',
    name: 'Lucía Fernández',
    type: 'Pleno',
    status: 'Pagado',
  },
  {
    id: 'mem-2',
    name: 'Carlos Méndez',
    type: 'Familiar',
    status: 'Pendiente',
  },
  {
    id: 'mem-3',
    name: 'Paula Ríos',
    type: 'Social',
    status: 'Vencido',
  },
];

const statusStyles = {
  Pagado: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/30',
  Pendiente: 'bg-amber-500/15 text-amber-200 border border-amber-500/30',
  Vencido: 'bg-rose-500/15 text-rose-200 border border-rose-500/30',
};

const buildPanelState = () => ({
  name: '',
  description: '',
  discount: '',
  validity: '',
});

function ActionPanel({ visible, title, subtitle, onClose, children }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <View className="rounded-t-3xl bg-[#0F172A] px-6 pb-8 pt-5 shadow-card">
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1">
              <Text className="text-white text-xl font-semibold">{title}</Text>
              {subtitle ? <Text className="text-white/60 mt-1">{subtitle}</Text> : null}
            </View>
            <Pressable
              onPress={onClose}
              className="h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5"
              accessibilityLabel="Cerrar panel"
            >
              <Ionicons name="close" size={18} color="#E2E8F0" />
            </Pressable>
          </View>
          <View className="mt-6 gap-4">{children}</View>
        </View>
      </View>
    </Modal>
  );
}

function ServiceCard({ service, onToggleEdit, onUpdate, isEditing }) {
  return (
    <Card className="gap-4">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-1">
          <Text className="text-white text-lg font-semibold">{service.name}</Text>
          <Text className="text-white/60 mt-1">{service.description}</Text>
        </View>
        <View className="items-end gap-2">
          <Pressable
            onPress={() => onToggleEdit(service.id)}
            className="flex-row items-center gap-2 rounded-full border border-white/10 px-3 py-1"
          >
            <Ionicons name={isEditing ? 'checkmark' : 'pencil'} size={14} color="#F8FAFC" />
            <Text className="text-white text-xs font-semibold">
              {isEditing ? 'Listo' : 'Editar'}
            </Text>
          </Pressable>
          <View
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              service.active ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-white/50'
            }`}
          >
            <Text className="text-xs font-semibold">
              {service.active ? 'Activo' : 'Pausado'}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-4">
        <View className="flex-1 min-w-[120px]">
          <Text className="text-white/60 text-xs mb-2">Precio</Text>
          {isEditing ? (
            <TextInput
              value={service.price}
              onChangeText={(value) => onUpdate(service.id, 'price', value)}
              keyboardType="numeric"
              className={FIELD_STYLES}
            />
          ) : (
            <Text className="text-white font-semibold text-base">${service.price}</Text>
          )}
        </View>
        <View className="flex-1 min-w-[120px]">
          <Text className="text-white/60 text-xs mb-2">Duración (min)</Text>
          {isEditing ? (
            <TextInput
              value={service.duration}
              onChangeText={(value) => onUpdate(service.id, 'duration', value)}
              keyboardType="numeric"
              className={FIELD_STYLES}
            />
          ) : (
            <Text className="text-white font-semibold text-base">{service.duration} min</Text>
          )}
        </View>
      </View>

      {isEditing ? (
        <View className="gap-3">
          <Text className="text-white/60 text-xs">Descripción</Text>
          <TextInput
            value={service.description}
            onChangeText={(value) => onUpdate(service.id, 'description', value)}
            multiline
            className={`${FIELD_STYLES} min-h-[96px]`}
          />
          <Pressable
            onPress={() => onUpdate(service.id, 'active', !service.active)}
            className="self-start rounded-full border border-white/10 px-3 py-2"
          >
            <Text className="text-white text-xs font-semibold">
              {service.active ? 'Pausar servicio' : 'Reactivar servicio'}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

export default function ServiciosScreen() {
  const [services, setServices] = useState(SERVICE_CATALOG);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [showTypePanel, setShowTypePanel] = useState(false);
  const [showPromoPanel, setShowPromoPanel] = useState(false);
  const [showCouponPanel, setShowCouponPanel] = useState(false);
  const [typeForm, setTypeForm] = useState(buildPanelState());
  const [promoForm, setPromoForm] = useState(buildPanelState());
  const [couponForm, setCouponForm] = useState(buildPanelState());

  const memberTotals = useMemo(() => {
    return MEMBERS.reduce(
      (acc, member) => {
        acc.total += 1;
        acc[member.status] = (acc[member.status] ?? 0) + 1;
        return acc;
      },
      { total: 0, Pagado: 0, Pendiente: 0, Vencido: 0 },
    );
  }, []);

  const handleServiceUpdate = (id, key, value) => {
    setServices((prev) =>
      prev.map((service) =>
        service.id === id
          ? {
              ...service,
              [key]: value,
            }
          : service,
      ),
    );
  };

  const handleToggleEdit = (id) => {
    setEditingServiceId((prev) => (prev === id ? null : id));
  };

  const resetPanels = () => {
    setTypeForm(buildPanelState());
    setPromoForm(buildPanelState());
    setCouponForm(buildPanelState());
  };

  return (
    <View className="flex-1 bg-mc-bg">
      <ScrollView contentContainerClassName="px-6 pb-12">
        <View className="py-6 gap-4">
          <View className="flex-row flex-wrap items-center justify-between gap-3">
            <Text className="text-white text-[28px] font-extrabold tracking-tight">
              Servicios y asociados
            </Text>
            <View className="flex-row flex-wrap items-center gap-3">
              <Pressable
                onPress={() => setShowTypePanel(true)}
                className={ACTION_BUTTON_STYLES}
              >
                <Ionicons name="people-outline" size={16} color="#F8FAFC" />
                <Text className="text-white text-sm font-semibold">Crear tipo de asociado</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowPromoPanel(true)}
                className={ACTION_BUTTON_STYLES}
              >
                <Ionicons name="sparkles-outline" size={16} color="#F8FAFC" />
                <Text className="text-white text-sm font-semibold">Crear promoción</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowCouponPanel(true)}
                className={ACTION_BUTTON_STYLES}
              >
                <Ionicons name="ticket-outline" size={16} color="#F8FAFC" />
                <Text className="text-white text-sm font-semibold">Crear cupón de descuento</Text>
              </Pressable>
            </View>
          </View>
          <Text className="text-white/60 max-w-3xl">
            Centralizá la configuración de servicios y el seguimiento de asociados. Ajustá precios,
            editá descripciones y administrá promociones sin salir del panel.
          </Text>
        </View>

        <View className="gap-6 lg:flex-row">
          <View className="flex-1 gap-6">
            <Card className="gap-4">
              <CardTitle colorClass="text-mc-info">Configuración de servicios</CardTitle>
              <Text className="text-white/60">
                Editá cada servicio con detalle, definí duraciones y mantené el catálogo actualizado.
              </Text>
              <View className="flex-row flex-wrap gap-4">
                <View className="flex-1 min-w-[140px]">
                  <Text className="text-white/60 text-xs">Servicios activos</Text>
                  <Text className="text-white text-xl font-semibold">
                    {services.filter((service) => service.active).length}
                  </Text>
                </View>
                <View className="flex-1 min-w-[140px]">
                  <Text className="text-white/60 text-xs">Servicios pausados</Text>
                  <Text className="text-white text-xl font-semibold">
                    {services.filter((service) => !service.active).length}
                  </Text>
                </View>
              </View>
            </Card>

            <View className="gap-5">
              {services.map((service) => (
                <ServiceCard
                  key={service.id}
                  service={service}
                  onToggleEdit={handleToggleEdit}
                  onUpdate={handleServiceUpdate}
                  isEditing={editingServiceId === service.id}
                />
              ))}
            </View>
          </View>

          <View className="flex-1 gap-6">
            <Card className="gap-4">
              <CardTitle colorClass="text-mc-warn">Tipos de asociados</CardTitle>
              <Text className="text-white/60">
                Definí planes para socios, cuotas mensuales y beneficios incluidos.
              </Text>
              <View className="gap-4">
                {MEMBER_TYPES.map((type) => (
                  <View
                    key={type.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-white font-semibold text-base">{type.name}</Text>
                        <Text className="text-white/60 mt-1">{type.access}</Text>
                      </View>
                      <View
                        className={`rounded-full px-3 py-1 ${
                          type.active ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/10 text-white/50'
                        }`}
                      >
                        <Text className="text-xs font-semibold">
                          {type.active ? 'Activo' : 'Inactivo'}
                        </Text>
                      </View>
                    </View>
                    <View className="flex-row items-center justify-between mt-3">
                      <Text className="text-white text-lg font-semibold">${type.price} / mes</Text>
                      <Pressable className="rounded-full border border-white/10 px-3 py-1">
                        <Text className="text-white text-xs font-semibold">Editar</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </Card>

            <Card className="gap-4">
              <CardTitle colorClass="text-mc-purpleAccent">Asociados</CardTitle>
              <Text className="text-white/60">
                Seguimiento rápido de pagos, altas y bajas de la membresía.
              </Text>
              <View className="flex-row flex-wrap gap-4">
                <View className="flex-1 min-w-[120px]">
                  <Text className="text-white/60 text-xs">Total</Text>
                  <Text className="text-white text-xl font-semibold">{memberTotals.total}</Text>
                </View>
                <View className="flex-1 min-w-[120px]">
                  <Text className="text-white/60 text-xs">Pagados</Text>
                  <Text className="text-white text-xl font-semibold">{memberTotals.Pagado}</Text>
                </View>
                <View className="flex-1 min-w-[120px]">
                  <Text className="text-white/60 text-xs">Pendientes</Text>
                  <Text className="text-white text-xl font-semibold">{memberTotals.Pendiente}</Text>
                </View>
              </View>
              <View className="gap-3">
                {MEMBERS.map((member) => (
                  <View
                    key={member.id}
                    className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1">
                        <Text className="text-white font-semibold">{member.name}</Text>
                        <Text className="text-white/60 text-xs mt-1">Plan {member.type}</Text>
                      </View>
                      <View className={`rounded-full px-3 py-1 ${statusStyles[member.status]}`}>
                        <Text className="text-xs font-semibold">{member.status}</Text>
                      </View>
                    </View>
                    <View className="flex-row flex-wrap gap-2 mt-3">
                      <Pressable className="rounded-full border border-white/10 px-3 py-1">
                        <Text className="text-white text-xs font-semibold">Marcar pago</Text>
                      </Pressable>
                      <Pressable className="rounded-full border border-white/10 px-3 py-1">
                        <Text className="text-white text-xs font-semibold">Suspender</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          </View>
        </View>
      </ScrollView>

      <ActionPanel
        visible={showTypePanel}
        title="Crear tipo de asociado"
        subtitle="Sumá nuevos planes con beneficios específicos."
        onClose={() => {
          setShowTypePanel(false);
          resetPanels();
        }}
      >
        <TextInput
          value={typeForm.name}
          onChangeText={(value) => setTypeForm((prev) => ({ ...prev, name: value }))}
          placeholder="Nombre del plan"
          placeholderTextColor="#94A3B8"
          className={FIELD_STYLES}
        />
        <TextInput
          value={typeForm.description}
          onChangeText={(value) => setTypeForm((prev) => ({ ...prev, description: value }))}
          placeholder="Beneficios incluidos"
          placeholderTextColor="#94A3B8"
          className={`${FIELD_STYLES} min-h-[96px]`}
          multiline
        />
        <TextInput
          value={typeForm.discount}
          onChangeText={(value) => setTypeForm((prev) => ({ ...prev, discount: value }))}
          placeholder="Cuota mensual"
          placeholderTextColor="#94A3B8"
          keyboardType="numeric"
          className={FIELD_STYLES}
        />
        <Pressable className="rounded-full bg-mc-primary px-4 py-3 items-center">
          <Text className="text-white font-semibold">Guardar tipo de asociado</Text>
        </Pressable>
      </ActionPanel>

      <ActionPanel
        visible={showPromoPanel}
        title="Crear promoción"
        subtitle="Generá campañas especiales para atraer asociados."
        onClose={() => {
          setShowPromoPanel(false);
          resetPanels();
        }}
      >
        <TextInput
          value={promoForm.name}
          onChangeText={(value) => setPromoForm((prev) => ({ ...prev, name: value }))}
          placeholder="Nombre de la promoción"
          placeholderTextColor="#94A3B8"
          className={FIELD_STYLES}
        />
        <TextInput
          value={promoForm.description}
          onChangeText={(value) => setPromoForm((prev) => ({ ...prev, description: value }))}
          placeholder="Detalle o beneficio"
          placeholderTextColor="#94A3B8"
          className={`${FIELD_STYLES} min-h-[96px]`}
          multiline
        />
        <View className="flex-row gap-3">
          <TextInput
            value={promoForm.discount}
            onChangeText={(value) => setPromoForm((prev) => ({ ...prev, discount: value }))}
            placeholder="Descuento"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            className={`${FIELD_STYLES} flex-1`}
          />
          <TextInput
            value={promoForm.validity}
            onChangeText={(value) => setPromoForm((prev) => ({ ...prev, validity: value }))}
            placeholder="Vigencia"
            placeholderTextColor="#94A3B8"
            className={`${FIELD_STYLES} flex-1`}
          />
        </View>
        <Pressable className="rounded-full bg-mc-primary px-4 py-3 items-center">
          <Text className="text-white font-semibold">Publicar promoción</Text>
        </Pressable>
      </ActionPanel>

      <ActionPanel
        visible={showCouponPanel}
        title="Crear cupón de descuento"
        subtitle="Administrá códigos y disponibilidad de descuentos."
        onClose={() => {
          setShowCouponPanel(false);
          resetPanels();
        }}
      >
        <TextInput
          value={couponForm.name}
          onChangeText={(value) => setCouponForm((prev) => ({ ...prev, name: value }))}
          placeholder="Código del cupón"
          placeholderTextColor="#94A3B8"
          className={FIELD_STYLES}
        />
        <TextInput
          value={couponForm.description}
          onChangeText={(value) => setCouponForm((prev) => ({ ...prev, description: value }))}
          placeholder="Detalle del beneficio"
          placeholderTextColor="#94A3B8"
          className={`${FIELD_STYLES} min-h-[96px]`}
          multiline
        />
        <View className="flex-row gap-3">
          <TextInput
            value={couponForm.discount}
            onChangeText={(value) => setCouponForm((prev) => ({ ...prev, discount: value }))}
            placeholder="% descuento"
            placeholderTextColor="#94A3B8"
            keyboardType="numeric"
            className={`${FIELD_STYLES} flex-1`}
          />
          <TextInput
            value={couponForm.validity}
            onChangeText={(value) => setCouponForm((prev) => ({ ...prev, validity: value }))}
            placeholder="Vigencia"
            placeholderTextColor="#94A3B8"
            className={`${FIELD_STYLES} flex-1`}
          />
        </View>
        <Pressable className="rounded-full bg-mc-primary px-4 py-3 items-center">
          <Text className="text-white font-semibold">Guardar cupón</Text>
        </Pressable>
      </ActionPanel>
    </View>
  );
}
