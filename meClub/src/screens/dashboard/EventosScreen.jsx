import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../features/auth/useAuth';
import { api, fetchClubCourts, fetchSports, searchTeams } from '../../lib/api';
import ActionButton from '../../components/ActionButton';
import Card from '../../components/Card';
import CardTitle from '../../components/CardTitle';
import ModalContainer from '../../components/ModalContainer';
import ScreenHeader from '../../components/ScreenHeader';

const ADV_BADGE = 'ADV';

const STATUS_LABELS = {
  inactivo: 'Inactivo',
  activo: 'En curso',
  pausado: 'Pausado',
  finalizado: 'Finalizado',
};

const resolveStatusLabel = (status) => {
  if (!status) return 'Programado';
  const normalized = String(status).toLowerCase();
  return STATUS_LABELS[normalized] ?? status;
};

const resolveGlobalScope = (zona) => {
  const normalized = String(zona ?? '').toLowerCase();
  if (normalized === 'regional') return 'provincia';
  return 'nacional';
};

const formatEventDate = (value) => {
  if (!value) return 'Sin fecha';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
};

const formatEventRange = (start, end) => {
  const startLabel = formatEventDate(start);
  const endLabel = formatEventDate(end);
  if (!start && !end) return 'Sin fecha';
  if (!start) return endLabel;
  if (!end || startLabel === endLabel) return startLabel;
  return `${startLabel} - ${endLabel}`;
};

const resolveLocationLabel = (evento) => {
  if (evento?.descripcion) return evento.descripcion;
  if (evento?.zona) return `Zona ${evento.zona}`;
  if (evento?.provincia_id) return `Provincia ${evento.provincia_id}`;
  return 'Sin descripción';
};

const resolveOrganizer = (evento) => {
  if (evento?.organizador) return evento.organizador;
  if (evento?.club_nombre) return evento.club_nombre;
  if (evento?.club_id) return `Club ${evento.club_id}`;
  return 'Organización';
};

const mapGlobalEvent = (evento) => ({
  id: evento?.evento_id ?? evento?.id ?? `global-${Math.random()}`,
  title: evento?.nombre ?? 'Evento',
  date: formatEventDate(evento?.fecha_inicio ?? evento?.fecha_fin),
  scope: resolveGlobalScope(evento?.zona),
  organizer: resolveOrganizer(evento),
});

const mapClubEvent = (evento) => ({
  id: evento?.evento_id ?? evento?.id ?? `event-${Math.random()}`,
  title: evento?.nombre ?? 'Evento',
  date: formatEventRange(evento?.fecha_inicio, evento?.fecha_fin),
  location: resolveLocationLabel(evento),
  type: evento?.tipo ?? 'amistoso',
  status: evento?.estado ?? 'programado',
  raw: evento,
});

const normalizeStatus = (status) => String(status ?? '').toLowerCase();

const STATUS_ORDER = {
  inactivo: 0,
  activo: 1,
  pausado: 2,
  finalizado: 3,
};

const DEFAULT_STANDINGS = [
  { id: 'st-1', team: 'Club Centro', played: 3, points: 7 },
  { id: 'st-2', team: 'Atlético Norte', played: 3, points: 6 },
  { id: 'st-3', team: 'Deportivo Sur', played: 3, points: 4 },
  { id: 'st-4', team: 'Social Este', played: 3, points: 3 },
  { id: 'st-5', team: 'Unión Oeste', played: 3, points: 1 },
];

const DEFAULT_BRACKET = [
  {
    name: 'Cuartos',
    matches: [
      { id: 'qf-1', teamA: 'Club Centro', teamB: 'Unión Oeste', winner: '' },
      { id: 'qf-2', teamA: 'Atlético Norte', teamB: 'Social Este', winner: '' },
      { id: 'qf-3', teamA: 'Deportivo Sur', teamB: 'Club Andes', winner: '' },
      { id: 'qf-4', teamA: 'Juventud', teamB: 'San Martín', winner: '' },
    ],
  },
  {
    name: 'Semifinal',
    matches: [
      { id: 'sf-1', teamA: '—', teamB: '—', winner: '' },
      { id: 'sf-2', teamA: '—', teamB: '—', winner: '' },
    ],
  },
  {
    name: 'Final',
    matches: [{ id: 'f-1', teamA: '—', teamB: '—', winner: '' }],
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
  Finalizado: {
    container: 'bg-slate-500/10 border-slate-400/40',
    text: 'text-slate-200',
  },
  Inactivo: {
    container: 'bg-indigo-500/10 border-indigo-400/40',
    text: 'text-indigo-100',
  },
};

function StatusPill({ status }) {
  const label = resolveStatusLabel(status);
  const styles = statusStyles[label] ?? statusStyles.Programado;
  return (
    <View className={`rounded-full px-3 py-[4px] border ${styles.container}`}>
      <Text className={`text-[12px] font-semibold ${styles.text}`} numberOfLines={1}>
        {label}
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

const EVENT_DATE_OPTIONS = (() => {
  const formatter = new Intl.DateTimeFormat('es-AR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
  return Array.from({ length: 45 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    const value = date.toISOString().slice(0, 10);
    return {
      value,
      label: formatter.format(date),
    };
  });
})();

const EVENT_TIME_OPTIONS = Array.from({ length: 30 }, (_, index) => {
  const hours = Math.floor(index / 2) + 8;
  const minutes = index % 2 === 0 ? '00' : '30';
  const label = `${String(hours).padStart(2, '0')}:${minutes}`;
  return { value: label, label };
});

const formatTimeInput = (input) => {
  const digits = String(input ?? '').replace(/\D/g, '').slice(0, 4);
  if (!digits) {
    return { formatted: '', isComplete: false, isValid: false };
  }
  if (digits.length <= 2) {
    return { formatted: digits, isComplete: false, isValid: false };
  }
  const hours = Number(digits.slice(0, 2));
  const minutes = Number(digits.slice(2, 4));
  const formatted = `${digits.slice(0, 2)}:${digits.slice(2)}`;
  const isComplete = digits.length === 4;
  const isValid = isComplete && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
  return { formatted, isComplete, isValid };
};

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

function SectionTitle({ title, subtitle }) {
  return (
    <View className="gap-1">
      <Text className="text-white text-sm font-semibold">{title}</Text>
      {subtitle ? <Text className="text-white/50 text-xs">{subtitle}</Text> : null}
    </View>
  );
}

function FriendlyEventModal({ visible, mode, initialValues, onClose, venues, sports, clubId }) {
  const [form, setForm] = useState(() => initialValues);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showVenuePicker, setShowVenuePicker] = useState(false);
  const [showSportPicker, setShowSportPicker] = useState(false);
  const [timeInput, setTimeInput] = useState('');
  const [timeInputError, setTimeInputError] = useState('');
  const [team1Query, setTeam1Query] = useState('');
  const [team2Query, setTeam2Query] = useState('');
  const [team1Results, setTeam1Results] = useState([]);
  const [team2Results, setTeam2Results] = useState([]);
  const [team1Loading, setTeam1Loading] = useState(false);
  const [team2Loading, setTeam2Loading] = useState(false);
  const [team1Error, setTeam1Error] = useState('');
  const [team2Error, setTeam2Error] = useState('');
  const [showTeam1Dropdown, setShowTeam1Dropdown] = useState(false);
  const [showTeam2Dropdown, setShowTeam2Dropdown] = useState(false);

  const isEditLocked = mode === 'edit' && initialValues?.status?.toLowerCase() !== 'inactivo';
  const editable = !isEditLocked;

  useEffect(() => {
    setForm(initialValues);
  }, [initialValues]);

  useEffect(() => {
    if (!visible) return;
    setShowDatePicker(false);
    setShowTimePicker(false);
    setShowVenuePicker(false);
    setShowSportPicker(false);
    setTimeInput(initialValues?.time ?? '');
    setTimeInputError('');
    setTeam1Query(initialValues?.team1 ?? '');
    setTeam2Query(initialValues?.team2 ?? '');
    setTeam1Results([]);
    setTeam2Results([]);
    setTeam1Error('');
    setTeam2Error('');
    setShowTeam1Dropdown(false);
    setShowTeam2Dropdown(false);
  }, [visible, initialValues]);

  useEffect(() => {
    if (!showTeam1Dropdown) return;
    const trimmed = team1Query.trim();
    if (trimmed.length < 2) {
      setTeam1Results([]);
      setTeam1Loading(false);
      setTeam1Error('');
      return;
    }
    let isActive = true;
    setTeam1Loading(true);
    setTeam1Error('');
    const timeout = setTimeout(async () => {
      try {
        const results = await searchTeams(trimmed, { limit: 8, clubId });
        if (isActive) {
          setTeam1Results(results);
        }
      } catch (error) {
        if (isActive) {
          setTeam1Error(error?.message || 'No se pudieron buscar equipos.');
        }
      } finally {
        if (isActive) {
          setTeam1Loading(false);
        }
      }
    }, 300);
    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [showTeam1Dropdown, team1Query]);

  useEffect(() => {
    if (!showTeam2Dropdown) return;
    const trimmed = team2Query.trim();
    if (trimmed.length < 2) {
      setTeam2Results([]);
      setTeam2Loading(false);
      setTeam2Error('');
      return;
    }
    let isActive = true;
    setTeam2Loading(true);
    setTeam2Error('');
    const timeout = setTimeout(async () => {
      try {
        const results = await searchTeams(trimmed, { limit: 8, clubId });
        if (isActive) {
          setTeam2Results(results);
        }
      } catch (error) {
        if (isActive) {
          setTeam2Error(error?.message || 'No se pudieron buscar equipos.');
        }
      } finally {
        if (isActive) {
          setTeam2Loading(false);
        }
      }
    }, 300);
    return () => {
      isActive = false;
      clearTimeout(timeout);
    };
  }, [showTeam2Dropdown, team2Query]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleTimeInputChange = (value) => {
    const { formatted, isComplete, isValid } = formatTimeInput(value);
    setTimeInput(formatted);
    if (isComplete && !isValid) {
      setTimeInputError('Ingresá una hora válida (00-23 / 00-59).');
      return;
    }
    setTimeInputError('');
    if (isValid) {
      handleChange('time', formatted);
    }
  };

  const renderPickerModal = ({
    visible: pickerVisible,
    onClose,
    options,
    selectedValue,
    onSelect,
    title: pickerTitle,
    emptyText = 'No hay datos disponibles',
    headerContent,
  }) => {
    if (!pickerVisible) return null;
    return (
      <ModalContainer
        visible={pickerVisible}
        onRequestClose={onClose}
        containerClassName="w-full max-w-xl max-h-[480px]"
      >
        <Card className="w-full max-h-[480px]">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-white text-lg font-semibold">{pickerTitle}</Text>
            <Pressable onPress={onClose} className="h-9 w-9 items-center justify-center rounded-full bg-white/5">
              <Ionicons name="close" size={18} color="white" />
            </Pressable>
          </View>
          {headerContent ? <View className="mb-3">{headerContent}</View> : null}
          <ScrollView className="max-h-[320px]" contentContainerClassName="pb-2">
            {options.map((option) => {
              const value = option.value ?? option.id ?? option.key ?? option;
              const label = option.label ?? option.nombre ?? option.title ?? String(option);
              const active = String(selectedValue) === String(value);
              return (
                <Pressable
                  key={value}
                  onPress={() => {
                    onSelect(value, option);
                    onClose();
                  }}
                  className={`rounded-xl px-4 py-3 mb-2 border border-white/5 ${
                    active ? 'bg-white/10 border-mc-warn' : 'bg-white/5'
                  }`}
                >
                  <Text className="text-white text-base font-medium">{label}</Text>
                  {option.description ? (
                    <Text className="text-white/60 text-sm mt-1">{option.description}</Text>
                  ) : null}
                </Pressable>
              );
            })}
            {options.length === 0 ? (
              <Text className="text-white/60 text-sm text-center">{emptyText}</Text>
            ) : null}
          </ScrollView>
        </Card>
      </ModalContainer>
    );
  };

  const renderTeamResults = ({ query, results, loading, error, onSelect }) => (
    <View className="mt-2 rounded-2xl border border-white/10 bg-white/5">
      {loading ? (
        <View className="px-4 py-3 flex-row items-center gap-2">
          <Text className="text-white/70 text-sm">Buscando equipos...</Text>
        </View>
      ) : null}
      {error ? (
        <View className="px-4 py-3">
          <Text className="text-rose-200 text-sm">{error}</Text>
        </View>
      ) : null}
      {!loading && !error && query.trim().length < 2 ? (
        <View className="px-4 py-3">
          <Text className="text-white/60 text-sm">Escribí al menos 2 caracteres para buscar</Text>
        </View>
      ) : null}
      {!loading && !error && query.trim().length >= 2 && results.length === 0 ? (
        <View className="px-4 py-3">
          <Text className="text-white/60 text-sm">Sin resultados</Text>
        </View>
      ) : null}
      {results.map((team) => (
        <Pressable
          key={team.id ?? team.nombre}
          onPress={() => onSelect(team)}
          className="px-4 py-3 border-b border-white/5"
        >
          <Text className="text-white text-sm font-medium">{team.nombre}</Text>
          {team.descripcion ? (
            <Text className="text-white/60 text-xs mt-1">{team.descripcion}</Text>
          ) : null}
        </Pressable>
      ))}
    </View>
  );

  const venueLabel =
    venues.find((venue) => String(venue.cancha_id ?? venue.id) === String(form.venue))?.nombre ??
    venues.find((venue) => String(venue.cancha_id ?? venue.id) === String(form.venue))?.label ??
    form.venue;

  const sportLabel =
    sports.find((sport) => String(sport.id ?? sport.deporte_id) === String(form.sport))?.nombre ??
    sports.find((sport) => String(sport.id ?? sport.deporte_id) === String(form.sport))?.label ??
    form.sport;

  return (
    <ModalContainer
      visible={visible}
      onRequestClose={onClose}
      containerClassName="w-full max-w-3xl max-h-[90vh]"
    >
      <View className="gap-5 rounded-3xl border border-white/10 bg-mc-surface p-6 shadow-xl">
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
              <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                Fecha
              </Text>
              <Pressable
                onPress={() => editable && setShowDatePicker(true)}
                className={`min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 ${
                  editable ? '' : 'opacity-60'
                }`}
              >
                <Text className="text-white text-sm">
                  {EVENT_DATE_OPTIONS.find((option) => option.value === form.date)?.label ||
                    form.date ||
                    'Seleccioná una fecha'}
                </Text>
              </Pressable>
            </View>
            <View className="flex-1">
              <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                Hora
              </Text>
              <Pressable
                onPress={() => {
                  if (!editable) return;
                  setTimeInput(form.time ?? '');
                  setShowTimePicker(true);
                }}
                className={`min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 ${
                  editable ? '' : 'opacity-60'
                }`}
              >
                <Text className="text-white text-sm">
                  {form.time || 'Seleccioná un horario'}
                </Text>
              </Pressable>
            </View>
          </View>
          <View className="gap-2">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Sede
            </Text>
            <Pressable
              onPress={() => editable && setShowVenuePicker(true)}
              className={`min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 ${
                editable ? '' : 'opacity-60'
              }`}
            >
              <Text className="text-white text-sm">
                {venueLabel || 'Seleccioná una sede'}
              </Text>
            </Pressable>
          </View>
          <View className="gap-2">
            <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
              Deporte
            </Text>
            <Pressable
              onPress={() => editable && setShowSportPicker(true)}
              className={`min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 ${
                editable ? '' : 'opacity-60'
              }`}
            >
              <Text className="text-white text-sm">
                {sportLabel || 'Seleccioná un deporte'}
              </Text>
            </Pressable>
          </View>
          <View className="flex-row gap-4">
            <View className="flex-1">
              <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                Equipo 1
              </Text>
              <TextInput
                className={FORM_FIELD_CLASSNAME}
                placeholder="Local"
                placeholderTextColor="#94A3B8"
                value={team1Query}
                onChangeText={(value) => {
                  setTeam1Query(value);
                  handleChange('team1', value);
                }}
                editable={editable}
                onFocus={() => setShowTeam1Dropdown(true)}
                onBlur={() => {
                  setTimeout(() => setShowTeam1Dropdown(false), 150);
                }}
              />
              {showTeam1Dropdown
                ? renderTeamResults({
                  query: team1Query,
                  results: team1Results,
                  loading: team1Loading,
                  error: team1Error,
                  onSelect: (team) => {
                    handleChange('team1', team.nombre);
                    setTeam1Query(team.nombre);
                    setShowTeam1Dropdown(false);
                  },
                })
                : null}
            </View>
            <View className="flex-1">
              <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                Equipo 2
              </Text>
              <TextInput
                className={FORM_FIELD_CLASSNAME}
                placeholder="Visitante"
                placeholderTextColor="#94A3B8"
                value={team2Query}
                onChangeText={(value) => {
                  setTeam2Query(value);
                  handleChange('team2', value);
                }}
                editable={editable}
                onFocus={() => setShowTeam2Dropdown(true)}
                onBlur={() => {
                  setTimeout(() => setShowTeam2Dropdown(false), 150);
                }}
              />
              {showTeam2Dropdown
                ? renderTeamResults({
                  query: team2Query,
                  results: team2Results,
                  loading: team2Loading,
                  error: team2Error,
                  onSelect: (team) => {
                    handleChange('team2', team.nombre);
                    setTeam2Query(team.nombre);
                    setShowTeam2Dropdown(false);
                  },
                })
                : null}
            </View>
          </View>
          <FormField
            label="Premio"
            placeholder="Trofeo + medallas"
            value={form.prize}
            onChangeText={(value) => handleChange('prize', value)}
            editable={editable}
          />
          <View className="gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <SectionTitle
              title="Resultado del amistoso"
              subtitle="Definí el marcador final y seleccioná el ganador."
            />
            <View className="flex-row gap-4">
              <View className="flex-1 gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                <Text className="text-white text-xs font-semibold uppercase tracking-wide">
                  {form.team1 || 'Equipo 1'}
                </Text>
                <TextInput
                  className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-white"
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  value={form.team1Score}
                  onChangeText={(value) => handleChange('team1Score', value.replace(/[^0-9]/g, ''))}
                  editable={editable}
                  keyboardType="numeric"
                />
              </View>
              <View className="flex-1 gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                <Text className="text-white text-xs font-semibold uppercase tracking-wide">
                  {form.team2 || 'Equipo 2'}
                </Text>
                <TextInput
                  className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-white"
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  value={form.team2Score}
                  onChangeText={(value) => handleChange('team2Score', value.replace(/[^0-9]/g, ''))}
                  editable={editable}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View className="gap-2">
              <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                Ganador
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {[form.team1 || 'Equipo 1', form.team2 || 'Equipo 2', 'Empate'].map((option) => (
                  <OptionPill
                    key={option}
                    label={option}
                    active={form.winner === option}
                    onPress={() => handleChange('winner', option)}
                    disabled={!editable}
                  />
                ))}
              </View>
            </View>
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
              {mode === 'edit' ? 'Guardar cambios' : 'Crear amistoso'}
            </Text>
          </Pressable>
        </View>
      </View>
      {renderPickerModal({
        visible: showDatePicker,
        onClose: () => setShowDatePicker(false),
        options: EVENT_DATE_OPTIONS,
        selectedValue: form.date,
        onSelect: (value) => handleChange('date', value),
        title: 'Seleccioná una fecha',
        emptyText: 'No hay fechas disponibles',
      })}
      {renderPickerModal({
        visible: showTimePicker,
        onClose: () => setShowTimePicker(false),
        options: EVENT_TIME_OPTIONS,
        selectedValue: form.time,
        onSelect: (value) => {
          handleChange('time', value);
          setTimeInput(value);
          setTimeInputError('');
        },
        title: 'Seleccioná un horario',
        headerContent: (
          <View className="gap-2">
            <Text className="text-white/70 text-xs">Ingresar manualmente</Text>
            <TextInput
              className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white"
              placeholder="HH:MM"
              placeholderTextColor="#94A3B8"
              value={timeInput}
              onChangeText={handleTimeInputChange}
              editable={editable}
              keyboardType="numeric"
            />
            {timeInputError ? (
              <Text className="text-rose-200 text-xs">{timeInputError}</Text>
            ) : null}
          </View>
        ),
        emptyText: 'No hay horarios disponibles',
      })}
      {renderPickerModal({
        visible: showVenuePicker,
        onClose: () => setShowVenuePicker(false),
        options: venues.map((venue) => ({
          value: venue.cancha_id ?? venue.id,
          label: venue.nombre ?? venue.label ?? `Cancha #${venue.cancha_id ?? venue.id}`,
          description: venue.descripcion ?? venue.deporte?.nombre,
        })),
        selectedValue: form.venue,
        onSelect: (value) => handleChange('venue', value),
        title: 'Seleccioná una sede',
        emptyText: 'No encontramos sedes disponibles',
      })}
      {renderPickerModal({
        visible: showSportPicker,
        onClose: () => setShowSportPicker(false),
        options: sports.map((sport) => ({
          value: sport.id ?? sport.deporte_id,
          label: sport.nombre ?? sport.label ?? `Deporte #${sport.id ?? sport.deporte_id}`,
        })),
        selectedValue: form.sport,
        onSelect: (value) => handleChange('sport', value),
        title: 'Seleccioná un deporte',
        emptyText: 'No encontramos deportes disponibles',
      })}
    </ModalContainer>
  );
}

function TournamentEventModal({ visible, mode, initialValues, onClose }) {
  const [form, setForm] = useState(() => initialValues);
  const [venues, setVenues] = useState(() => initialValues?.venues ?? []);
  const [newVenue, setNewVenue] = useState('');
  const [standings, setStandings] = useState(() => initialValues?.standings ?? []);

  const isEditLocked = mode === 'edit' && initialValues?.status?.toLowerCase() !== 'inactivo';
  const editable = !isEditLocked;

  useEffect(() => {
    setForm(initialValues);
    setVenues(initialValues?.venues ?? []);
    setStandings(initialValues?.standings ?? []);
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

  const handleStandingChange = (index, field, value) => {
    if (!editable) return;
    setStandings((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [field]: value } : row
      )
    );
  };

  const moveStanding = (index, direction) => {
    if (!editable) return;
    setStandings((prev) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      const [row] = next.splice(index, 1);
      next.splice(targetIndex, 0, row);
      return next;
    });
  };

  return (
    <ModalContainer visible={visible} onRequestClose={onClose} containerClassName="w-full max-w-4xl max-h-[90vh]">
      <View className="gap-5 rounded-3xl border border-white/10 bg-mc-surface p-6 shadow-xl">
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
          <View className="gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <SectionTitle
              title="Tabla de posiciones"
              subtitle="Actualizá puntos y reordená la tabla según resultados."
            />
            <View className="flex-row items-center justify-between border-b border-white/10 pb-2">
              <Text className="text-white/50 text-xs w-8">#</Text>
              <Text className="text-white/50 text-xs flex-1">Equipo</Text>
              <Text className="text-white/50 text-xs w-12 text-center">PJ</Text>
              <Text className="text-white/50 text-xs w-12 text-center">PTS</Text>
              <Text className="text-white/50 text-xs w-16 text-right">Orden</Text>
            </View>
            {standings.length === 0 ? (
              <Text className="text-white/40 text-xs">Sin posiciones cargadas.</Text>
            ) : (
              standings.map((row, index) => (
                <View
                  key={row.id ?? `${row.team}-${index}`}
                  className="flex-row items-center gap-3 border-b border-white/5 py-2"
                >
                  <Text className="text-white/60 text-xs w-8">{index + 1}</Text>
                  <TextInput
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-white text-xs"
                    value={row.team}
                    onChangeText={(value) => handleStandingChange(index, 'team', value)}
                    editable={editable}
                  />
                  <TextInput
                    className="w-12 rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-center text-white text-xs"
                    value={String(row.played)}
                    onChangeText={(value) =>
                      handleStandingChange(index, 'played', value.replace(/[^0-9]/g, ''))
                    }
                    editable={editable}
                    keyboardType="numeric"
                  />
                  <TextInput
                    className="w-12 rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-center text-white text-xs"
                    value={String(row.points)}
                    onChangeText={(value) =>
                      handleStandingChange(index, 'points', value.replace(/[^0-9]/g, ''))
                    }
                    editable={editable}
                    keyboardType="numeric"
                  />
                  <View className="flex-row gap-1 w-16 justify-end">
                    <Pressable
                      onPress={() => moveStanding(index, -1)}
                      disabled={!editable || index === 0}
                      className={`h-7 w-7 items-center justify-center rounded-full ${
                        !editable || index === 0 ? 'bg-white/10' : 'bg-white/5'
                      }`}
                    >
                      <Ionicons name="chevron-up" size={14} color="#E2E8F0" />
                    </Pressable>
                    <Pressable
                      onPress={() => moveStanding(index, 1)}
                      disabled={!editable || index === standings.length - 1}
                      className={`h-7 w-7 items-center justify-center rounded-full ${
                        !editable || index === standings.length - 1 ? 'bg-white/10' : 'bg-white/5'
                      }`}
                    >
                      <Ionicons name="chevron-down" size={14} color="#E2E8F0" />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
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
  const [bracket, setBracket] = useState(() => initialValues?.bracket ?? []);

  const isEditLocked = mode === 'edit' && initialValues?.status?.toLowerCase() !== 'inactivo';
  const editable = !isEditLocked;

  useEffect(() => {
    setForm(initialValues);
    setVenues(initialValues?.venues ?? []);
    setBracket(initialValues?.bracket ?? []);
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

  const handleSelectWinner = (roundIndex, matchIndex, team) => {
    if (!editable) return;
    setBracket((prev) => {
      const next = prev.map((round) => ({
        ...round,
        matches: round.matches.map((match) => ({ ...match })),
      }));
      const round = next[roundIndex];
      if (!round) return prev;
      const match = round.matches[matchIndex];
      if (!match) return prev;
      match.winner = team;
      if (next[roundIndex + 1]) {
        const nextRound = next[roundIndex + 1];
        const nextMatchIndex = Math.floor(matchIndex / 2);
        const slot = matchIndex % 2 === 0 ? 'teamA' : 'teamB';
        nextRound.matches[nextMatchIndex][slot] = team;
      }
      return next;
    });
  };

  return (
    <ModalContainer visible={visible} onRequestClose={onClose} containerClassName="w-full max-w-4xl max-h-[90vh]">
      <View className="gap-5 rounded-3xl border border-white/10 bg-mc-surface p-6 shadow-xl">
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
          <View className="gap-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <SectionTitle
              title="Fixture por llaves"
              subtitle="Seleccioná ganadores y avanzá de ronda."
            />
            <View className="flex-col gap-4 lg:flex-row">
              {bracket.map((round, roundIndex) => (
                <View key={round.name} className="flex-1 gap-3">
                  <Text className="text-white/70 text-xs font-semibold uppercase tracking-wide">
                    {round.name}
                  </Text>
                  <View className="gap-3">
                    {round.matches.map((match, matchIndex) => (
                      <View
                        key={match.id ?? `${round.name}-${matchIndex}`}
                        className="gap-2 rounded-2xl border border-white/10 bg-white/5 p-3"
                      >
                        {[match.teamA, match.teamB].map((team) => (
                          <Pressable
                            key={`${match.id}-${team}`}
                            onPress={() => handleSelectWinner(roundIndex, matchIndex, team)}
                            disabled={!editable}
                            className={`rounded-xl border px-3 py-2 ${
                              match.winner === team
                                ? 'border-emerald-400/60 bg-emerald-500/10'
                                : 'border-white/10 bg-white/5'
                            } ${!editable ? 'opacity-60' : ''}`}
                          >
                            <Text className="text-white text-xs font-semibold">{team}</Text>
                          </Pressable>
                        ))}
                        <Text className="text-white/40 text-[11px]">
                          Ganador: {match.winner || 'Sin definir'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
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
  const [events, setEvents] = useState([]);
  const [eventsStatus, setEventsStatus] = useState({ loading: false, error: null });
  const [globalEvents, setGlobalEvents] = useState([]);
  const [globalEventsStatus, setGlobalEventsStatus] = useState({ loading: false, error: null });
  const [venues, setVenues] = useState([]);
  const [sports, setSports] = useState([]);
  const clubLevel = useMemo(() => {
    const parsed = Number(user?.nivel_id ?? 1);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }, [user?.nivel_id]);
  const hasProAccess = clubLevel >= 2;

  const filteredGlobalEvents = useMemo(() => {
    return globalEvents.filter((event) => event.scope === filter);
  }, [filter, globalEvents]);

  const { orderedEvents, finalizedEvents } = useMemo(() => {
    const sorted = [...events].sort((a, b) => {
      const aOrder = STATUS_ORDER[normalizeStatus(a.status)] ?? 0;
      const bOrder = STATUS_ORDER[normalizeStatus(b.status)] ?? 0;
      return aOrder - bOrder;
    });
    const finalizados = sorted.filter(
      (event) => normalizeStatus(event.status) === 'finalizado'
    );
    const activos = sorted.filter(
      (event) => normalizeStatus(event.status) !== 'finalizado'
    );
    return { orderedEvents: activos, finalizedEvents: finalizados };
  }, [events]);

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

  useEffect(() => {
    let isMounted = true;
    const loadClubEvents = async () => {
      setEventsStatus({ loading: true, error: null });
      try {
        const data = await api.get('/eventos');
        const eventos = Array.isArray(data?.eventos) ? data.eventos : [];
        if (isMounted) {
          setEvents(eventos.map(mapClubEvent));
          setEventsStatus({ loading: false, error: null });
        }
      } catch (error) {
        if (isMounted) {
          setEvents([]);
          setEventsStatus({
            loading: false,
            error: error?.message || 'No se pudieron cargar los eventos.',
          });
        }
      }
    };

    loadClubEvents();

    const loadGlobalEvents = async () => {
      if (!user?.clubId) {
        setGlobalEvents([]);
        return;
      }
      setGlobalEventsStatus({ loading: true, error: null });
      try {
        const data = await api.get(`/eventos/globales?club_id=${user.clubId}`);
        const eventos = Array.isArray(data?.eventos) ? data.eventos : [];
        if (isMounted) {
          setGlobalEvents(eventos.map(mapGlobalEvent));
        }
      } catch (error) {
        if (isMounted) {
          setGlobalEventsStatus({
            loading: false,
            error: error?.message || 'No se pudieron cargar los eventos globales.',
          });
        }
        return;
      }
      if (isMounted) {
        setGlobalEventsStatus({ loading: false, error: null });
      }
    };
    loadGlobalEvents();
    return () => {
      isMounted = false;
    };
  }, [user?.clubId]);

  useEffect(() => {
    let isMounted = true;
    const loadVenues = async () => {
      try {
        const data = await fetchClubCourts();
        const filtered = data.filter((court) => {
          const status = String(court?.estado ?? court?.status ?? '').toLowerCase();
          if (!status) return true;
          return ['disponible', 'activa', 'activo', 'available'].includes(status);
        });
        if (isMounted) {
          setVenues(filtered);
        }
      } catch (error) {
        if (isMounted) {
          setVenues([]);
        }
      }
    };
    loadVenues();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadSports = async () => {
      try {
        const data = await fetchSports();
        if (isMounted) {
          setSports(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        if (isMounted) {
          setSports([]);
        }
      }
    };
    loadSports();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleOpenEdit = (event) => {
    setActiveMode('edit');
    setSelectedEvent(event);
    setActiveModal(event.type);
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setSelectedEvent(null);
  };

  const updateEventStatus = (eventoId, estado) => {
    setEvents((prev) =>
      prev.map((event) =>
        event.id === eventoId ? { ...event, status: estado ?? event.status } : event
      )
    );
  };

  const handleStartEvent = async (event) => {
    try {
      const data = await api.post(`/eventos/${event.id}/iniciar`);
      updateEventStatus(event.id, data?.evento?.estado ?? 'activo');
    } catch (error) {
      console.error(error);
    }
  };

  const handlePauseEvent = async (event) => {
    try {
      const data = await api.post(`/eventos/${event.id}/pausar`);
      updateEventStatus(event.id, data?.evento?.estado ?? 'pausado');
    } catch (error) {
      console.error(error);
    }
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
      team1Score: selectedEvent?.team1Score ?? '',
      team2Score: selectedEvent?.team2Score ?? '',
      winner: selectedEvent?.winner ?? '',
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
      standings: selectedEvent?.standings ?? DEFAULT_STANDINGS,
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
      bracket: selectedEvent?.bracket ?? DEFAULT_BRACKET,
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
              icon="sparkles-outline"
              label="Crear Amistoso"
              backgroundClassName="bg-emerald-400 hover:bg-emerald-400/80"
            />
            <ActionButton
              onPress={() => handleOpenCreate('torneo')}
              disabled={!hasProAccess}
              icon="trophy-outline"
              label="Crear Torneo"
              badge={lockedButtonProps.badge}
              backgroundClassName={lockedButtonProps.backgroundClassName}
              className={lockedButtonProps.className}
            />
            <ActionButton
              onPress={() => handleOpenCreate('copa')}
              disabled={!hasProAccess}
              icon="flag-outline"
              label="Crear Copa"
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
              {eventsStatus.loading ? (
                <Text className="text-white/60 text-sm">Cargando eventos...</Text>
              ) : null}
              {eventsStatus.error ? (
                <Text className="text-rose-200 text-sm">{eventsStatus.error}</Text>
              ) : null}
              {!eventsStatus.loading &&
              !eventsStatus.error &&
              orderedEvents.length === 0 &&
              finalizedEvents.length === 0 ? (
                  <Text className="text-white/50 text-sm">No hay eventos registrados.</Text>
                ) : null}
              {orderedEvents.map((event) => (
                <Pressable
                  key={event.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  onPress={() => handleOpenEdit(event)}
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
                      onPress={(pressEvent) => {
                        pressEvent?.stopPropagation?.();
                        handleOpenEdit(event);
                      }}
                    >
                      <Text className="text-white text-xs font-semibold">Editar</Text>
                    </Pressable>
                    <Pressable
                      className="rounded-full border border-emerald-400/40 px-3 py-1"
                      onPress={(pressEvent) => {
                        pressEvent?.stopPropagation?.();
                        handleStartEvent(event);
                      }}
                    >
                      <Text className="text-emerald-200 text-xs font-semibold">Iniciar</Text>
                    </Pressable>
                    <Pressable
                      className="rounded-full border border-amber-400/40 px-3 py-1"
                      onPress={(pressEvent) => {
                        pressEvent?.stopPropagation?.();
                        handlePauseEvent(event);
                      }}
                    >
                      <Text className="text-amber-200 text-xs font-semibold">Pausar</Text>
                    </Pressable>
                    <Pressable className="rounded-full border border-rose-500/40 px-3 py-1">
                      <Text className="text-rose-200 text-xs font-semibold">Eliminar</Text>
                    </Pressable>
                  </View>
                </Pressable>
              ))}
              {finalizedEvents.length > 0 ? (
                <View className="gap-3 pt-2">
                  <View className="flex-row items-center gap-3">
                    <View className="h-px flex-1 bg-white/10" />
                    <Text className="text-white/50 text-xs font-semibold uppercase tracking-wide">
                      Eventos finalizados
                    </Text>
                    <View className="h-px flex-1 bg-white/10" />
                  </View>
                </View>
              ) : null}
              {finalizedEvents.map((event) => (
                <Pressable
                  key={event.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                  onPress={() => handleOpenEdit(event)}
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
                      onPress={(pressEvent) => {
                        pressEvent?.stopPropagation?.();
                        handleOpenEdit(event);
                      }}
                    >
                      <Text className="text-white text-xs font-semibold">Editar</Text>
                    </Pressable>
                    <Pressable
                      className="rounded-full border border-emerald-400/40 px-3 py-1"
                      onPress={(pressEvent) => {
                        pressEvent?.stopPropagation?.();
                        handleStartEvent(event);
                      }}
                    >
                      <Text className="text-emerald-200 text-xs font-semibold">Iniciar</Text>
                    </Pressable>
                    <Pressable
                      className="rounded-full border border-amber-400/40 px-3 py-1"
                      onPress={(pressEvent) => {
                        pressEvent?.stopPropagation?.();
                        handlePauseEvent(event);
                      }}
                    >
                      <Text className="text-amber-200 text-xs font-semibold">Pausar</Text>
                    </Pressable>
                    <Pressable className="rounded-full border border-rose-500/40 px-3 py-1">
                      <Text className="text-rose-200 text-xs font-semibold">Eliminar</Text>
                    </Pressable>
                  </View>
                </Pressable>
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
              {globalEventsStatus.loading ? (
                <Text className="text-white/60 text-sm">Cargando eventos globales...</Text>
              ) : null}
              {globalEventsStatus.error ? (
                <Text className="text-rose-200 text-sm">{globalEventsStatus.error}</Text>
              ) : null}
              {!globalEventsStatus.loading && !globalEventsStatus.error && filteredGlobalEvents.length === 0 ? (
                <Text className="text-white/50 text-sm">
                  No hay eventos globales disponibles para este filtro.
                </Text>
              ) : null}
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
        venues={venues}
        sports={sports}
        clubId={user?.clubId}
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
