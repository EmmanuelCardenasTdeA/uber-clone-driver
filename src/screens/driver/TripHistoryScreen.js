// src/screens/driver/TripHistoryScreen.js
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import { useEarnings } from '../../hooks/useEarnings';
import { formatPaymentMethodLabel } from '../../services/tripServices';
import TripDetailScreen from './TripDetailScreen';

const DATE_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'today', label: 'Hoy' },
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'range', label: 'Rango de fechas' },
];

const PAYMENT_FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'mercadopago', label: 'Mercado Pago' },
  { key: 'stripe', label: 'Stripe' },
  { key: 'cash', label: 'Efectivo' },
];

const formatDateYMD = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export default function TripHistoryScreen() {
  const { driverId } = useRegistration();
  const insets = useSafeAreaInsets();

  const {
    allTrips,
    loading,
    error,
    visibleLimit,
    loadMoreTrips,
    resetPagination,
  } = useEarnings(driverId);

  const [dateFilter, setDateFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [selectedTrip, setSelectedTrip] = useState(null);

  // Rango de fechas personalizado
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  const [startDate, setStartDate] = useState(sevenDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Filtrado memorizado con useMemo por fecha y por método de pago (Sección 6)
  const filteredTrips = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const startOfWeek = new Date(startOfToday);
    const dayOfWeek = startOfWeek.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const rangeStart = new Date(
      startDate.getFullYear(),
      startDate.getMonth(),
      startDate.getDate(),
      0,
      0,
      0
    );
    const rangeEnd = new Date(
      endDate.getFullYear(),
      endDate.getMonth(),
      endDate.getDate(),
      23,
      59,
      59
    );

    return allTrips.filter((trip) => {
      // Excluir solicitudes aún en 'requested' sin cerrar
      if (trip.status === 'requested') return false;

      // 1. Filtro por fecha
      const tDate = trip.tripDate;
      if (dateFilter === 'today' && tDate < startOfToday) return false;
      if (dateFilter === 'week' && tDate < startOfWeek) return false;
      if (dateFilter === 'month' && tDate < startOfMonth) return false;
      if (dateFilter === 'range' && (tDate < rangeStart || tDate > rangeEnd)) {
        return false;
      }

      // 2. Filtro por método de pago
      if (paymentFilter !== 'all') {
        const rawMethod = String(trip.paymentMethod || '').toLowerCase();
        const normalizedMethod =
          rawMethod === 'efectivo'
            ? 'cash'
            : rawMethod === 'mercado pago'
            ? 'mercadopago'
            : rawMethod === 'tarjeta'
            ? 'stripe'
            : rawMethod;
        if (normalizedMethod !== paymentFilter) return false;
      }

      return true;
    });
  }, [allTrips, dateFilter, paymentFilter, startDate, endDate]);

  // Paginación limitada a 20 viajes por carga (Sección 6)
  const paginatedTrips = useMemo(
    () => filteredTrips.slice(0, visibleLimit),
    [filteredTrips, visibleLimit]
  );

  // Si el conductor toca un viaje, abrir la pantalla de Detalle con la ruta en el mapa
  if (selectedTrip) {
    return (
      <TripDetailScreen
        trip={selectedTrip}
        onBack={() => setSelectedTrip(null)}
      />
    );
  }

  const getStatusBadge = (trip) => {
    const pStatus = String(trip.paymentStatus || '').toLowerCase();
    if (trip.status === 'paid' || pStatus === 'approved' || pStatus === 'cash') {
      return {
        label: trip.paymentMethod === 'cash' ? 'Efectivo' : 'Aprobado',
        bg: '#DCFCE7',
        color: '#166534',
      };
    }
    if (trip.status === 'completed') {
      return { label: 'Pendiente cobro', bg: '#FEF3C7', color: '#92400E' };
    }
    if (trip.status === 'cancelled' || trip.status === 'rejected') {
      return { label: 'Cancelado', bg: '#FEE2E2', color: '#991B1B' };
    }
    return { label: trip.status, bg: '#E5E7EB', color: '#374151' };
  };

  const renderTripItem = ({ item }) => {
    const badge = getStatusBadge(item);
    return (
      <TouchableOpacity
        style={styles.tripCard}
        onPress={() => setSelectedTrip(item)}
        activeOpacity={0.85}
      >
        {/* Cabecera: fecha y hora + categoría + estado del pago */}
        <View style={styles.tripHeaderRow}>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
            <Text style={styles.dateText}>
              {item.tripDate.toLocaleDateString('es-CO')}{' '}
              {item.tripDate.toLocaleTimeString('es-CO', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>

          <View style={styles.badgesGroup}>
            <View style={styles.categoryChip}>
              <Text style={styles.categoryChipText}>
                {(item.category || 'economy').toUpperCase()}
              </Text>
            </View>
            <View style={[styles.statusChip, { backgroundColor: badge.bg }]}>
              <Text style={[styles.statusChipText, { color: badge.color }]}>
                {badge.label}
              </Text>
            </View>
          </View>
        </View>

        {/* Origen -> Destino */}
        <View style={styles.routeBox}>
          <View style={styles.routeLineRow}>
            <Ionicons name="radio-button-on" size={15} color="#2563EB" />
            <Text style={styles.addressText} numberOfLines={1}>
              {item.origin?.address || 'Origen'}
            </Text>
          </View>
          <View style={styles.routeLineRow}>
            <Ionicons name="arrow-forward-outline" size={15} color="#9CA3AF" />
            <Ionicons name="location" size={15} color="#DC2626" />
            <Text style={styles.addressText} numberOfLines={1}>
              {item.destination?.address || 'Destino'}
            </Text>
          </View>
        </View>

        {/* Pie de tarjeta: método de pago, tarifa y ganancia neta */}
        <View style={styles.tripFooterRow}>
          <View style={styles.paymentMethodRow}>
            <Ionicons name="wallet-outline" size={15} color="#4B5563" />
            <Text style={styles.paymentMethodText}>
              {formatPaymentMethodLabel(item.paymentMethod)}
            </Text>
          </View>

          <View style={styles.amountsRow}>
            <Text style={styles.fareText}>
              Tarifa: ${(item.fare || 0).toLocaleString('es-CO')}
            </Text>
            <Text style={styles.netText}>
              Neta: ${(item.driverEarnings || 0).toLocaleString('es-CO')}
            </Text>
            <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screen}>
      {/* Bloque de filtros: Fecha y Método de Pago */}
      <View style={styles.filtersContainer}>
        <Text style={styles.filterGroupLabel}>Filtrar por periodo:</Text>
        <View style={styles.chipsWrap}>
          {DATE_FILTERS.map((f) => {
            const active = dateFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => {
                  setDateFilter(f.key);
                  resetPagination();
                }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selector de Rango de Fechas (Desde / Hasta) */}
        {dateFilter === 'range' && (
          <View style={styles.dateRangeBox}>
            <TouchableOpacity
              style={styles.dateRangeBtn}
              onPress={() => setShowStartPicker(true)}
            >
              <Ionicons name="calendar-outline" size={15} color="#111827" />
              <Text style={styles.dateRangeBtnText}>
                Desde: {formatDateYMD(startDate)}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dateRangeBtn}
              onPress={() => setShowEndPicker(true)}
            >
              <Ionicons name="calendar-outline" size={15} color="#111827" />
              <Text style={styles.dateRangeBtnText}>
                Hasta: {formatDateYMD(endDate)}
              </Text>
            </TouchableOpacity>

            {showStartPicker && (
              <DateTimePicker
                value={startDate}
                mode="date"
                display="default"
                maximumDate={endDate}
                onChange={(event, selected) => {
                  if (Platform.OS === 'android') setShowStartPicker(false);
                  if (event.type === 'set' && selected) {
                    setStartDate(selected);
                  }
                }}
              />
            )}

            {showEndPicker && (
              <DateTimePicker
                value={endDate}
                mode="date"
                display="default"
                minimumDate={startDate}
                maximumDate={new Date()}
                onChange={(event, selected) => {
                  if (Platform.OS === 'android') setShowEndPicker(false);
                  if (event.type === 'set' && selected) {
                    setEndDate(selected);
                  }
                }}
              />
            )}
          </View>
        )}

        <Text style={[styles.filterGroupLabel, { marginTop: 6 }]}>
          Método de pago:
        </Text>
        <View style={styles.chipsWrap}>
          {PAYMENT_FILTERS.map((pf) => {
            const active = paymentFilter === pf.key;
            return (
              <TouchableOpacity
                key={pf.key}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => {
                  setPaymentFilter(pf.key);
                  resetPagination();
                }}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    active && styles.filterChipTextActive,
                  ]}
                >
                  {pf.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Listado con FlatList, orden más reciente a más antiguo y paginación de 20 viajes */}
      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#111827" />
          <Text style={styles.emptySubtitle}>Cargando historial de carreras...</Text>
        </View>
      ) : (
        <FlatList
          data={paginatedTrips}
          keyExtractor={(item) => item.id}
          renderItem={renderTripItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(insets.bottom + 24, 36) },
          ]}
          showsVerticalScrollIndicator={false}
          onEndReached={() => {
            if (paginatedTrips.length < filteredTrips.length) {
              loadMoreTrips();
            }
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="file-tray-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyTitle}>Sin carreras en este filtro</Text>
              <Text style={styles.emptySubtitle}>
                No se encontraron viajes que coincidan con el periodo o método de pago seleccionado.
              </Text>
            </View>
          }
          ListFooterComponent={
            paginatedTrips.length < filteredTrips.length ? (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={loadMoreTrips}
              >
                <Ionicons name="add-circle-outline" size={18} color="#111827" />
                <Text style={styles.loadMoreText}>
                  Cargar más viajes ({paginatedTrips.length} de {filteredTrips.length})
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  filtersContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    gap: 6,
  },
  filterGroupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4B5563',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  filterChipActive: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  dateRangeBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  dateRangeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingVertical: 8,
  },
  dateRangeBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#111827',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  errorText: { color: '#DC2626', fontSize: 12, flex: 1 },
  listContent: {
    padding: 16,
    gap: 12,
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  tripHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  badgesGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryChipText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#374151',
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  routeBox: {
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 10,
    gap: 6,
  },
  routeLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addressText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
  },
  tripFooterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  paymentMethodText: {
    fontSize: 12,
    color: '#4B5563',
    fontWeight: '600',
  },
  amountsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fareText: {
    fontSize: 12,
    color: '#6B7280',
  },
  netText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16A34A',
  },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 10,
  },
  emptyContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
  },
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  loadMoreText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
});
