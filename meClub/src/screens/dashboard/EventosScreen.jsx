import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../features/auth/useAuth';
import ActionButton from '../../components/ActionButton';
import Card from '../../components/Card';
import CardTitle from '../../components/CardTitle';
import ModalContainer from '../../components/ModalContainer';
import ScreenHeader from '../../components/ScreenHeader';

const ADV_BADGE = 'ADV';

const myEvents = [
  {
    id: 'evt-1',
    title: 'Amistoso Interclub',
    date: 'Vie 20 Sep · 19:30',
    location: 'Club Centro',
    type: 'amistoso',
    status: 'Programado',
  },
  {
    id: 'evt-2',
    title: 'Torneo Liga Mixto',
    date: 'Sáb 28 Sep · 09:00',
    location: 'Canchas Norte',
    type: 'torneo',
    status: 'En curso',
  },
  {
    id: 'evt-3',
    title: 'Copa Primavera',
    date: 'Dom 06 Oct · 15:00',
    location: 'Sede Sur',
    type: 'copa',
    status: 'Pausado',
  },
  {
    id: 'evt-4',
    title: 'Copa Aniversario',
    date: 'Sáb 19 Oct · 17:00',
    location: 'Sede Central',
    type: 'copa',
    status: 'Inactivo',
  },
];

const globalEvents = [
  {
    id: 'g-1',
    title: 'Liga Provincial · Fecha 4',
    date: 'Sáb 21 Sep',
    scope: 'provincia',
    organizer: 'Federación Provincial',
  },
  {
    id: 'g-2',
    title: 'Copa Nacional Juvenil',
    date: 'Dom 29 Sep',
    scope: 'nacional',
    organizer: 'Asociación Nacional',
  },
  {
    id: 'g-3',
    title: 'Encuentro Regional',
    date: 'Vie 04 Oct',
    scope: 'provincia',
    organizer: 'Liga Metropolitana',
  },
  {
    id: 'g-4',
    title: 'Master Nacional',
    date: 'Sáb 12 Oct',
    scope: 'nacional',
    organizer: 'Comité Nacional',
  },
];

const statusStyles = {
  Programado: {
    container: 'bg-sky-500/10 border-sky-400/40',
    text: 'text-sky-100',
  },
  'En curso': {
    container: 'bg-emerald-500/10 border-emerald-400/40',
    text: 'text-emerald-100',
  },
  Pausado: {
    container: 'bg-amber-500/10 border-amber-400/40',
    text: 'text-amber-100',
  },
};

function StatusPill({ status }) {
  const styles = statusStyles[status] ?? statusStyles.Programado;
  return (
    <View className={`rounded-full px-3 py-[4px] border ${styles.container}`}>
      <Text className={`text-[12px] font-semibold ${styles.text}`} numberOfLines={1}>
        {status}
      </Text>
    </View>
  );
}

function FilterPill({ active, label, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-full px-4 py-[6px] border ${
        active
          ? 'bg-white/10 border-white/20'
          : 'bg-transparent border-white/10 hover:bg-white/5'
      }`}
    >
      <Text className={`text-[12px] font-semibold ${active ? 'text-white' : 'text-white/70'}`}>
        {label}
      </Text>
    </Pressable>
  );
}

const FORM_FIELD_CLASSNAME =
  'min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white';

function FormField({ label, placeholder, value, onChangeText, editable = true, keyboardType }) {
  return (
    <View className="gap-2">
      <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">{label}</Text>
      <TextInput
        className={FORM_FIELD_CLASSNAME}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function OptionPill({ label, active, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className={`rounded-full border px-3 py-1 ${
        active
          ? 'border-emerald-400/60 bg-emerald-500/10'
          : 'border-white/10 bg-white/5'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <Text className="text-xs font-semibold text-white">{label}</Text>
    </Pressable>
  );
}

function ModalHeader({ title, subtitle, onClose }) {
  return (
    <View className="flex-row items-start justify-between gap-4">
      <View className="flex-1 gap-1">
        <Text className="text-white text-lg font-semibold">{title}</Text>
        {subtitle ? <Text className="text-white/60 text-xs">{subtitle}</Text> : null}
      </View>
      <Pressable onPress={onClose} className="h-9 w-9 items-center justify-center rounded-full bg-white/5">
        <Ionicons name="close" size={18} color="#E2E8F0" />
      </Pressable>
    </View>
  );
}

function FriendlyEventModal({ visible, mode, initialValues, onClose }) {
  const [form, setForm] = useState(() => initialValues);

  const isEditLocked = mode === 'edit' && initialValues?.status?.toLowerCase() !== 'inactivo';
  const editable = !isEditLocked;

  useEffect(() => {
    setForm(initialValues);
  }, [initialValues]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <ModalContainer visible={visible} onRequestClose={onClose}>
      <View className="gap-5 rounded-3xl border border-white/10 bg-mc-card p-6 shadow-xl">
        <ModalHeader
          title={mode === 'edit' ? 'Editar amistoso' : 'Nuevo amistoso'}
          subtitle="Completá la información clave del amistoso."
          onClose={onClose}
        />
        {isEditLocked ? (
          <View className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3">
            <Text className="text-amber-100 text-xs">
              Solo podés editar eventos en estado inactivo.
            </Text>
          </View>
        ) : null}
        <View className="gap-4">
          <FormField
            label="Título"
            placeholder="Amistoso de pretemporada"
            value={form.title}
            onChangeText={(value) => handleChange('title', value)}
            editable={editable}
          />
          <View className="flex-row gap-4">
            <View className="flex-1">
              <FormField
                label="Fecha"
                placeholder="20/09/2024"
                value={form.date}
                onChangeText={(value) => handleChange('date', value)}
                editable={editable}
              />
            </View>
            <View className="flex-1">
              <FormField
                label="Hora"
                placeholder="19:30"
                value={form.time}
                onChangeText={(value) => handleChange('time', value)}
                editable={editable}
              />
            </View>
          </View>
          <FormField
            label="Sede"
            placeholder="Club Centro"
            value={form.venue}
            onChangeText={(value) => handleChange('venue', value)}
            editable={editable}
          />
          <FormField
            label="Deporte"
            placeholder="Fútbol, tenis, básquet"
            value={form.sport}
            onChangeText={(value) => handleChange('sport', value)}
            editable={editable}
          />
          <View className="flex-row gap-4">
            <View className="flex-1">
              <FormField
                label="Equipo 1"
                placeholder="Local"
                value={form.team1}
                onChangeText={(value) => handleChange('team1', value)}
                editable={editable}
              />
            </View>
            <View className="flex-1">
              <FormField
                label="Equipo 2"
                placeholder="Visitante"
                value={form.team2}
                onChangeText={(value) => handleChange('team2', value)}
                editable={editable}
              />
            </View>
          </View>
          <FormField
            label="Premio"
            placeholder="Trofeo + medallas"
            value={form.prize}
            onChangeText={(value) => handleChange('prize', value)}
            editable={editable}
          />
        </View>
        <View className="flex-row justify-end gap-3 pt-2">
          <Pressable onPress={onClose} className="rounded-full border border-white/15 px-4 py-2">
            <Text className="text-white text-xs font-semibold">Cancelar</Text>
          </Pressable>
          <Pressable
            disabled={!editable}
            className={`rounded-full px-4 py-2 ${editable ? 'bg-emerald-500/80' : 'bg-white/10'}`}
          >
            <Text className="text-white text-xs font-semibold">
              {mode === 'edit' ? 'Guardar cambios' : 'Crear amistoso'}
            </Text>
          </Pressable>
        </View>
      </View>
    </ModalContainer>
  );
}

function TournamentEventModal({ visible, mode, initialValues, onClose }) {
  const [form, setForm] = useState(() => initialValues);
  const [venues, setVenues] = useState(() => initialValues?.venues ?? []);
  const [newVenue, setNewVenue] = useState('');

  const isEditLocked = mode === 'edit' && initialValues?.status?.toLowerCase() !== 'inactivo';
  const editable = !isEditLocked;

  useEffect(() => {
    setForm(initialValues);
    setVenues(initialValues?.venues ?? []);
  }, [initialValues]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddVenue = () => {
    if (!editable) return;
    if (!newVenue.trim()) return;
    if (venues.length >= 10) return;
    setVenues((prev) => [...prev, newVenue.trim()]);
    setNewVenue('');
  };

  const handleRemoveVenue = (index) => {
    if (!editable) return;
    setVenues((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUploadPdf = () => {
    if (!editable) return;
    const filename = `reglamento-${Date.now()}.pdf`;
    setForm((prev) => ({ ...prev, pdfName: filename }));
  };

  const handleTeamCount = (value) => {
    const normalized = value.replace(/[^0-9]/g, '');
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      handleChange('teams', '');
      return;
    }
    const clamped = Math.max(5, Math.min(40, parsed));
    handleChange('teams', String(clamped));
  };

  return (
    <ModalContainer visible={visible} onRequestClose={onClose} containerClassName="w-full max-w-4xl max-h-[90vh]">
      <View className="gap-5 rounded-3xl border border-white/10 bg-mc-card p-6 shadow-xl">
        <ModalHeader
          title={mode === 'edit' ? 'Editar torneo/liga' : 'Nuevo torneo o liga'}
          subtitle="Definí estructura, sedes y reglamento del torneo."
          onClose={onClose}
        />
        {isEditLocked ? (
          <View className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3">
            <Text className="text-amber-100 text-xs">
              Solo podés editar eventos en estado inactivo.
            </Text>
          </View>
        ) : null}
        <View className="gap-4">
          <FormField
            label="Nombre"
            placeholder="Liga Primavera 2024"
            value={form.name}
            onChangeText={(value) => handleChange('name', value)}
            editable={editable}
          />
          <View className="flex-row gap-4">
            <View className="flex-1">
              <FormField
                label="Fechas"
                placeholder="Sep - Nov"
                value={form.dates}
                onChangeText={(value) => handleChange('dates', value)}
                editable={editable}
              />
            </View>
            <View className="flex-1">
              <FormField
                label="Zona"
                placeholder="Zona Norte"
                value={form.zone}
                onChangeText={(value) => handleChange('zone', value)}
                editable={editable}
              />
            </View>
          </View>
          <View className="gap-3">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Sedes (máximo 10)
            </Text>
            <View className="flex-row gap-2">
              <TextInput
                className={FORM_FIELD_CLASSNAME}
                placeholder="Agregar sede"
                placeholderTextColor="#94A3B8"
                value={newVenue}
                onChangeText={setNewVenue}
                editable={editable}
              />
              <Pressable
                onPress={handleAddVenue}
                disabled={!editable || venues.length >= 10}
                className={`h-[44px] items-center justify-center rounded-xl px-4 ${
                  !editable || venues.length >= 10 ? 'bg-white/10' : 'bg-emerald-500/70'
                }`}
              >
                <Text className="text-white text-xs font-semibold">Agregar</Text>
              </Pressable>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {venues.length === 0 ? (
                <Text className="text-white/40 text-xs">Sin sedes cargadas.</Text>
              ) : (
                venues.map((venue, index) => (
                  <View
                    key={`${venue}-${index}`}
                    className="flex-row items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1"
                  >
                    <Text className="text-white text-xs">{venue}</Text>
                    {editable ? (
                      <Pressable onPress={() => handleRemoveVenue(index)}>
                        <Ionicons name="close" size={14} color="#CBD5F5" />
                      </Pressable>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </View>
          <View className="flex-row gap-4">
            <View className="flex-1">
              <FormField
                label="Cantidad de equipos"
                placeholder="5-40"
                value={form.teams}
                onChangeText={handleTeamCount}
                editable={editable}
                keyboardType="numeric"
              />
              <Text className="text-white/40 text-xs mt-1">Min 5 · Max 40</Text>
            </View>
            <View className="flex-1">
              <FormField
                label="Deporte"
                placeholder="Fútbol"
                value={form.sport}
                onChangeText={(value) => handleChange('sport', value)}
                editable={editable}
              />
            </View>
          </View>
          <View className="gap-2">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">Formato</Text>
            <View className="flex-row gap-2">
              <OptionPill
                label="Ida"
                active={form.round === 'ida'}
                onPress={() => handleChange('round', 'ida')}
                disabled={!editable}
              />
              <OptionPill
                label="Ida y vuelta"
                active={form.round === 'ida-vuelta'}
                onPress={() => handleChange('round', 'ida-vuelta')}
                disabled={!editable}
              />
            </View>
          </View>
          <FormField
            label="Premios"
            placeholder="Trofeos, premios en efectivo"
            value={form.prizes}
            onChangeText={(value) => handleChange('prizes', value)}
            editable={editable}
          />
          <View className="flex-row gap-4">
            <View className="flex-1">
              <FormField
                label="Inscripción"
                placeholder="$ 12.000"
                value={form.entry}
                onChangeText={(value) => handleChange('entry', value)}
                editable={editable}
              />
            </View>
            <View className="flex-1">
              <FormField
                label="Días de juego"
                placeholder="Sábados y domingos"
                value={form.days}
                onChangeText={(value) => handleChange('days', value)}
                editable={editable}
              />
            </View>
          </View>
          <View className="gap-3">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Reglamento (PDF)
            </Text>
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={handleUploadPdf}
                disabled={!editable}
                className={`rounded-full px-4 py-2 ${
                  editable ? 'bg-sky-500/70' : 'bg-white/10'
                }`}
              >
                <Text className="text-white text-xs font-semibold">Subir PDF</Text>
              </Pressable>
              <Text className="text-white/60 text-xs">
                {form.pdfName ? form.pdfName : 'Sin archivo cargado'}
              </Text>
            </View>
            <FormField
              label="URL del reglamento"
              placeholder="https://..."
              value={form.pdfUrl}
              onChangeText={(value) => handleChange('pdfUrl', value)}
              editable={editable}
            />
          </View>
        </View>
        <View className="flex-row justify-end gap-3 pt-2">
          <Pressable onPress={onClose} className="rounded-full border border-white/15 px-4 py-2">
            <Text className="text-white text-xs font-semibold">Cancelar</Text>
          </Pressable>
          <Pressable
            disabled={!editable}
            className={`rounded-full px-4 py-2 ${editable ? 'bg-emerald-500/80' : 'bg-white/10'}`}
          >
            <Text className="text-white text-xs font-semibold">
              {mode === 'edit' ? 'Guardar cambios' : 'Crear torneo'}
            </Text>
          </Pressable>
        </View>
      </View>
    </ModalContainer>
  );
}

function CupEventModal({ visible, mode, initialValues, onClose }) {
  const [form, setForm] = useState(() => initialValues);
  const [venues, setVenues] = useState(() => initialValues?.venues ?? []);
  const [newVenue, setNewVenue] = useState('');

  const isEditLocked = mode === 'edit' && initialValues?.status?.toLowerCase() !== 'inactivo';
  const editable = !isEditLocked;

  useEffect(() => {
    setForm(initialValues);
    setVenues(initialValues?.venues ?? []);
  }, [initialValues]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddVenue = () => {
    if (!editable) return;
    if (!newVenue.trim()) return;
    if (venues.length >= 10) return;
    setVenues((prev) => [...prev, newVenue.trim()]);
    setNewVenue('');
  };

  const handleRemoveVenue = (index) => {
    if (!editable) return;
    setVenues((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUploadPdf = () => {
    if (!editable) return;
    const filename = `reglamento-${Date.now()}.pdf`;
    setForm((prev) => ({ ...prev, pdfName: filename }));
  };

  return (
    <ModalContainer visible={visible} onRequestClose={onClose} containerClassName="w-full max-w-4xl max-h-[90vh]">
      <View className="gap-5 rounded-3xl border border-white/10 bg-mc-card p-6 shadow-xl">
        <ModalHeader
          title={mode === 'edit' ? 'Editar copa' : 'Nueva copa'}
          subtitle="Configurá el cuadro y la logística de la copa."
          onClose={onClose}
        />
        {isEditLocked ? (
          <View className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3">
            <Text className="text-amber-100 text-xs">
              Solo podés editar eventos en estado inactivo.
            </Text>
          </View>
        ) : null}
        <View className="gap-4">
          <FormField
            label="Nombre"
            placeholder="Copa Club"
            value={form.name}
            onChangeText={(value) => handleChange('name', value)}
            editable={editable}
          />
          <View className="flex-row gap-4">
            <View className="flex-1">
              <FormField
                label="Fechas"
                placeholder="Octubre"
                value={form.dates}
                onChangeText={(value) => handleChange('dates', value)}
                editable={editable}
              />
            </View>
            <View className="flex-1">
              <FormField
                label="Zona"
                placeholder="Zona Sur"
                value={form.zone}
                onChangeText={(value) => handleChange('zone', value)}
                editable={editable}
              />
            </View>
          </View>
          <View className="gap-3">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Sedes (máximo 10)
            </Text>
            <View className="flex-row gap-2">
              <TextInput
                className={FORM_FIELD_CLASSNAME}
                placeholder="Agregar sede"
                placeholderTextColor="#94A3B8"
                value={newVenue}
                onChangeText={setNewVenue}
                editable={editable}
              />
              <Pressable
                onPress={handleAddVenue}
                disabled={!editable || venues.length >= 10}
                className={`h-[44px] items-center justify-center rounded-xl px-4 ${
                  !editable || venues.length >= 10 ? 'bg-white/10' : 'bg-emerald-500/70'
                }`}
              >
                <Text className="text-white text-xs font-semibold">Agregar</Text>
              </Pressable>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {venues.length === 0 ? (
                <Text className="text-white/40 text-xs">Sin sedes cargadas.</Text>
              ) : (
                venues.map((venue, index) => (
                  <View
                    key={`${venue}-${index}`}
                    className="flex-row items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1"
                  >
                    <Text className="text-white text-xs">{venue}</Text>
                    {editable ? (
                      <Pressable onPress={() => handleRemoveVenue(index)}>
                        <Ionicons name="close" size={14} color="#CBD5F5" />
                      </Pressable>
                    ) : null}
                  </View>
                ))
              )}
            </View>
          </View>
          <View className="gap-2">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Cantidad de equipos
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {[4, 8, 16, 32, 64].map((option) => (
                <OptionPill
                  key={option}
                  label={`${option}`}
                  active={Number(form.teams) === option}
                  onPress={() => handleChange('teams', String(option))}
                  disabled={!editable}
                />
              ))}
            </View>
          </View>
          <View className="flex-row gap-4">
            <View className="flex-1">
              <FormField
                label="Deporte"
                placeholder="Fútbol"
                value={form.sport}
                onChangeText={(value) => handleChange('sport', value)}
                editable={editable}
              />
            </View>
            <View className="flex-1">
              <FormField
                label="Días de juego"
                placeholder="Fines de semana"
                value={form.days}
                onChangeText={(value) => handleChange('days', value)}
                editable={editable}
              />
            </View>
          </View>
          <FormField
            label="Premios"
            placeholder="Trofeo y medallas"
            value={form.prizes}
            onChangeText={(value) => handleChange('prizes', value)}
            editable={editable}
          />
          <FormField
            label="Inscripción"
            placeholder="$ 15.000"
            value={form.entry}
            onChangeText={(value) => handleChange('entry', value)}
            editable={editable}
          />
          <View className="gap-3">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Reglamento (PDF)
            </Text>
            <View className="flex-row items-center gap-3">
              <Pressable
                onPress={handleUploadPdf}
                disabled={!editable}
                className={`rounded-full px-4 py-2 ${
                  editable ? 'bg-sky-500/70' : 'bg-white/10'
                }`}
              >
                <Text className="text-white text-xs font-semibold">Subir PDF</Text>
              </Pressable>
              <Text className="text-white/60 text-xs">
                {form.pdfName ? form.pdfName : 'Sin archivo cargado'}
              </Text>
            </View>
            <FormField
              label="URL del reglamento"
              placeholder="https://..."
              value={form.pdfUrl}
              onChangeText={(value) => handleChange('pdfUrl', value)}
              editable={editable}
            />
          </View>
        </View>
        <View className="flex-row justify-end gap-3 pt-2">
          <Pressable onPress={onClose} className="rounded-full border border-white/15 px-4 py-2">
            <Text className="text-white text-xs font-semibold">Cancelar</Text>
          </Pressable>
          <Pressable
            disabled={!editable}
            className={`rounded-full px-4 py-2 ${editable ? 'bg-emerald-500/80' : 'bg-white/10'}`}
          >
            <Text className="text-white text-xs font-semibold">
              {mode === 'edit' ? 'Guardar cambios' : 'Crear copa'}
            </Text>
          </Pressable>
        </View>
      </View>
    </ModalContainer>
  );
}

export default function EventosScreen() {
  const { user } = useAuth();
  const [filter, setFilter] = useState('provincia');
  const [activeModal, setActiveModal] = useState(null);
  const [activeMode, setActiveMode] = useState('create');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const clubLevel = useMemo(() => {
    const parsed = Number(user?.nivel_id ?? 1);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }, [user?.nivel_id]);
  const hasProAccess = clubLevel >= 2;

  const filteredGlobalEvents = useMemo(() => {
    return globalEvents.filter((event) => event.scope === filter);
  }, [filter]);

  const lockedButtonProps = hasProAccess
    ? {
      badge: null,
      backgroundClassName: 'bg-emerald-400 hover:bg-emerald-400/80',
      className: '',
    }
    : {
      badge: ADV_BADGE,
      backgroundClassName: 'bg-mc-warn/25',
      className: 'border border-sky-400/50',
    };

  const handleOpenCreate = (type) => {
    setActiveMode('create');
    setSelectedEvent(null);
    setActiveModal(type);
  };

  const handleOpenEdit = (event) => {
    setActiveMode('edit');
    setSelectedEvent(event);
    setActiveModal(event.type);
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setSelectedEvent(null);
  };

  const friendlyInitialValues = useMemo(
    () => ({
      title: selectedEvent?.title ?? '',
      date: selectedEvent?.date ?? '',
      time: selectedEvent?.time ?? '',
      venue: selectedEvent?.location ?? '',
      sport: selectedEvent?.sport ?? '',
      team1: selectedEvent?.team1 ?? '',
      team2: selectedEvent?.team2 ?? '',
      prize: selectedEvent?.prize ?? '',
      status: selectedEvent?.status ?? '',
    }),
    [selectedEvent]
  );

  const tournamentInitialValues = useMemo(
    () => ({
      name: selectedEvent?.title ?? '',
      dates: selectedEvent?.dates ?? '',
      zone: selectedEvent?.zone ?? '',
      teams: selectedEvent?.teams ?? '',
      sport: selectedEvent?.sport ?? '',
      round: selectedEvent?.round ?? 'ida',
      prizes: selectedEvent?.prizes ?? '',
      entry: selectedEvent?.entry ?? '',
      days: selectedEvent?.days ?? '',
      pdfName: selectedEvent?.pdfName ?? '',
      pdfUrl: selectedEvent?.pdfUrl ?? '',
      venues: selectedEvent?.venues ?? [],
      status: selectedEvent?.status ?? '',
    }),
    [selectedEvent]
  );

  const cupInitialValues = useMemo(
    () => ({
      name: selectedEvent?.title ?? '',
      dates: selectedEvent?.dates ?? '',
      zone: selectedEvent?.zone ?? '',
      teams: selectedEvent?.teams ?? '',
      sport: selectedEvent?.sport ?? '',
      prizes: selectedEvent?.prizes ?? '',
      entry: selectedEvent?.entry ?? '',
      days: selectedEvent?.days ?? '',
      pdfName: selectedEvent?.pdfName ?? '',
      pdfUrl: selectedEvent?.pdfUrl ?? '',
      venues: selectedEvent?.venues ?? [],
      status: selectedEvent?.status ?? '',
    }),
    [selectedEvent]
  );

  return (
    <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 32 }}>
      <View className="flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <View className="flex-1 basis-1/2">
          <ScreenHeader
            title="Eventos"
            subtitle="Gestioná eventos propios y revisá propuestas provinciales o nacionales."
            className="items-start text-left"
          />
        </View>
        <View className="flex-1 basis-1/2 items-end py-8">
          <View className="grid grid-cols-3 gap-3 self-end">
            <ActionButton
              onPress={() => handleOpenCreate('amistoso')}
              disabled={!hasProAccess}
              icon="sparkles-outline"
              label="Crear Amistoso"
              badge={lockedButtonProps.badge}
              backgroundClassName={lockedButtonProps.backgroundClassName}
              className={lockedButtonProps.className}
            />
            <ActionButton
              onPress={() => handleOpenCreate('torneo')}
              disabled={!hasProAccess}
              icon="trophy-outline"
              label="Torneo-Liga"
              badge={lockedButtonProps.badge}
              backgroundClassName={lockedButtonProps.backgroundClassName}
              className={lockedButtonProps.className}
            />
            <ActionButton
              onPress={() => handleOpenCreate('copa')}
              disabled={!hasProAccess}
              icon="flag-outline"
              label="Copa"
              badge={lockedButtonProps.badge}
              backgroundClassName={lockedButtonProps.backgroundClassName}
              className={lockedButtonProps.className}
            />
          </View>
        </View>
      </View>

      <View className="gap-6 lg:flex-row">
        <View className="flex-1 gap-6">
          <Card className="gap-4 pb-6">
            <CardTitle colorClass="text-mc-info">Mis Eventos</CardTitle>
            <Text className="text-white/60">
              Organizá tus eventos internos y controlá el estado de cada convocatoria.
            </Text>
            <View className="mt-4 gap-4">
              {myEvents.map((event) => (
                <View
                  key={event.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-white font-semibold">{event.title}</Text>
                      <Text className="text-white/60 text-xs mt-1">{event.date}</Text>
                      <Text className="text-white/40 text-xs mt-1">{event.location}</Text>
                    </View>
                    <StatusPill status={event.status} />
                  </View>
                  <View className="flex-row flex-wrap gap-2 mt-4">
                    <Pressable
                      className="rounded-full border border-white/10 px-3 py-1"
                      onPress={() => handleOpenEdit(event)}
                    >
                      <Text className="text-white text-xs font-semibold">Editar</Text>
                    </Pressable>
                    <Pressable className="rounded-full border border-emerald-400/40 px-3 py-1">
                      <Text className="text-emerald-200 text-xs font-semibold">Iniciar</Text>
                    </Pressable>
                    <Pressable className="rounded-full border border-amber-400/40 px-3 py-1">
                      <Text className="text-amber-200 text-xs font-semibold">Pausar</Text>
                    </Pressable>
                    <Pressable className="rounded-full border border-rose-500/40 px-3 py-1">
                      <Text className="text-rose-200 text-xs font-semibold">Eliminar</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </View>

        <View className="flex-1 gap-6">
          <Card className="gap-4 pb-6">
            <View className="flex-row items-center justify-between gap-3">
              <CardTitle colorClass="text-mc-info">Eventos Globales</CardTitle>
              <View className="flex-row gap-2">
                <FilterPill
                  label="Provincia"
                  active={filter === 'provincia'}
                  onPress={() => setFilter('provincia')}
                />
                <FilterPill
                  label="Nacional"
                  active={filter === 'nacional'}
                  onPress={() => setFilter('nacional')}
                />
              </View>
            </View>
            <Text className="text-white/60">
              Explorá convocatorias oficiales y definí tu participación según región.
            </Text>
            <View className="mt-4 gap-4">
              {filteredGlobalEvents.map((event) => (
                <View
                  key={event.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1">
                      <Text className="text-white font-semibold">{event.title}</Text>
                      <Text className="text-white/60 text-xs mt-1">{event.date}</Text>
                      <Text className="text-white/40 text-xs mt-1">{event.organizer}</Text>
                    </View>
                    <View className="h-9 w-9 rounded-full bg-white/5 border border-white/10 items-center justify-center">
                      <Ionicons name="calendar-outline" size={18} color="#E2E8F0" />
                    </View>
                  </View>
                  <View className="flex-row flex-wrap gap-2 mt-4">
                    <Pressable className="rounded-full border border-white/10 px-3 py-1">
                      <Text className="text-white text-xs font-semibold">Ver detalles</Text>
                    </Pressable>
                    <Pressable className="rounded-full border border-white/10 px-3 py-1">
                      <Text className="text-white text-xs font-semibold">Postular club</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </View>
      </View>
      <FriendlyEventModal
        visible={activeModal === 'amistoso'}
        mode={activeMode}
        initialValues={friendlyInitialValues}
        onClose={handleCloseModal}
      />
      <TournamentEventModal
        visible={activeModal === 'torneo'}
        mode={activeMode}
        initialValues={tournamentInitialValues}
        onClose={handleCloseModal}
      />
      <CupEventModal
        visible={activeModal === 'copa'}
        mode={activeMode}
        initialValues={cupInitialValues}
        onClose={handleCloseModal}
      />
    </ScrollView>
  );
}
