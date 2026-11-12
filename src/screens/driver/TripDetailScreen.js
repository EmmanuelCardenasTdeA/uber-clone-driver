// src/screens/driver/TripDetailScreen.js
import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  buildInterpolatedRoute,
  formatPaymentMethodLabel,
} from '../../services/tripServices';
import { parseTripDate } from '../../hooks/useEarnings';

export default function TripDetailScreen({ trip, onBack }) {
  const mapRef = useRef(null);
  const insets = useSafeAreaInsets();

  const originCoord = useMemo(() => {
    const lat = trip?.origin?.latitude ?? trip?.origin?.lat ?? 6.2442;
    const lng = trip?.origin?.longitude ?? trip?.origin?.lng ?? -75.5812;
    return { latitude: Number(lat), longitude: Number(lng) };
  }, [trip]);

  const destCoord = useMemo(() => {
    const lat = trip?.destination?.latitude ?? trip?.destination?.lat ?? 6.2518;
    const lng = trip?.destination?.longitude ?? trip?.destination?.lng ?? -75.5742;
    return { latitude: Number(lat), longitude: Number(lng) };
  }, [trip]);

  const routeCoords = useMemo(() => {
    if (trip?.routeCoordinates?.length > 1) {
      return trip.routeCoordinates.map((pt) => ({
        latitude: Number(pt.latitude ?? pt.lat),
        longitude: Number(pt.longitude ?? pt.lng),
      }));
    }
    return buildInterpolatedRoute(originCoord, destCoord, 14);
  }, [trip, originCoord, destCoord]);

  useEffect(() => {
    if (mapRef.current && routeCoords.length > 1) {
      mapRef.current.fitToCoordinates(routeCoords, {
        edgePadding: { top: 45, right: 45, bottom: 45, left: 45 },
        animated: true,
      });
    }
  }, [routeCoords]);

  if (!trip) return null;

  const tripDate = parseTripDate(trip.completedAt || trip.createdAt);
  const ratingValue = Math.min(5, Math.max(1, Math.round(Number(trip.rating ?? trip.passengerRating) || 5)));
  const commissionPct = Math.round((Number(trip.commissionRate) || 0.2) * 100);

  const getPaymentStatusBadge = () => {
    const pStatus = String(trip.paymentStatus || '').toLowerCase();
    if (pStatus === 'approved' || trip.status === 'paid') {
      return {
        label: trip.paymentMethod === 'cash' ? 'Efectivo recibido' : 'Pago Aprobado',
        bg: '#DCFCE7',
        color: '#166534',
      };
    }
    if (pStatus === 'rejected' || trip.status === 'rejected' || trip.status === 'cancelled') {
      return { label: 'Cancelado / Rechazado', bg: '#FEE2E2', color: '#991B1B' };
    }
    return { label: 'Pendiente', bg: '#FEF3C7', color: '#92400E' };
  };

  const badge = getPaymentStatusBadge();

  return (
    <View style={styles.screen}>
      {/* Barra superior para regresar al listado */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back-outline" size={20} color="#111827" />
          <Text style={styles.backBtnText}>Volver al historial</Text>
        </TouchableOpacity>
        <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.statusBadgeText, { color: badge.color }]}>
            {badge.label}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom + 24, 36) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Mapa con la ruta guardada dibujada con Polyline (Secciones 6 y 7) */}
        <View style={styles.mapCard}>
          <MapView
            ref={mapRef}
            style={styles.map}
            initialRegion={{
              latitude: originCoord.latitude,
              longitude: originCoord.longitude,
              latitudeDelta: 0.025,
              longitudeDelta: 0.025,
            }}
          >
            {routeCoords.length > 1 && (
              <Polyline
                coordinates={routeCoords}
                strokeWidth={5}
                strokeColor="#16A34A"
              />
            )}

            <Marker
              coordinate={originCoord}
              title="Origen"
              description={trip.origin?.address}
            >
              <View style={styles.originMarker}>
                <Ionicons name="radio-button-on" size={14} color="#FFFFFF" />
              </View>
            </Marker>

            <Marker
              coordinate={destCoord}
              title="Destino"
              description={trip.destination?.address}
            >
              <View style={styles.destMarker}>
                <Ionicons name="flag" size={14} color="#FFFFFF" />
              </View>
            </Marker>
          </MapView>
        </View>

        {/* Cabecera de fecha, pasajero y calificación */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.passengerName}>{trip.passengerName || 'Pasajero'}</Text>
              <Text style={styles.dateText}>
                {tripDate.toLocaleDateString('es-CO', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })}{' '}
                •{' '}
                {tripDate.toLocaleTimeString('es-CO', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>

            {/* Calificación del pasajero (1 a 5 estrellas con Ionicons) */}
            <View style={styles.ratingBox}>
              <Text style={styles.ratingLabel}>Calificación</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name={star <= ratingValue ? 'star' : 'star-outline'}
                    size={15}
                    color="#F59E0B"
                  />
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Origen, Destino, Distancia, Duración y Categoría */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Recorrido y métricas</Text>

          <View style={styles.pointRow}>
            <Ionicons name="radio-button-on" size={18} color="#2563EB" />
            <View style={{ flex: 1 }}>
              <Text style={styles.pointLabel}>Punto de recogida (Origen)</Text>
              <Text style={styles.pointAddress}>{trip.origin?.address}</Text>
            </View>
          </View>

          <View style={styles.pointRow}>
            <Ionicons name="location" size={18} color="#DC2626" />
            <View style={{ flex: 1 }}>
              <Text style={styles.pointLabel}>Destino final</Text>
              <Text style={styles.pointAddress}>{trip.destination?.address}</Text>
            </View>
          </View>

          <View style={styles.statsStrip}>
            <View style={styles.statChip}>
              <Ionicons name="speedometer-outline" size={16} color="#111827" />
              <Text style={styles.statChipText}>{trip.distanceKm || 0} km</Text>
            </View>
            <View style={styles.statChip}>
              <Ionicons name="time-outline" size={16} color="#111827" />
              <Text style={styles.statChipText}>{trip.durationMin || 0} min</Text>
            </View>
            <View style={styles.statChip}>
              <Ionicons name="car-sport-outline" size={16} color="#111827" />
              <Text style={styles.statChipText}>
                {(trip.category || 'economy').toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Desglose financiero de la carrera */}
        <View style={styles.card}>
          <Text style={styles.sectionHeader}>Desglose financiero</Text>

          <View style={styles.financeRow}>
            <Text style={styles.financeLabel}>Método de pago</Text>
            <Text style={styles.financeValue}>
              {formatPaymentMethodLabel(trip.paymentMethod)}
            </Text>
          </View>

          <View style={styles.financeRow}>
            <Text style={styles.financeLabel}>Tarifa del viaje</Text>
            <Text style={styles.financeValue}>
              ${(trip.fare || 0).toLocaleString('es-CO')} COP
            </Text>
          </View>

          <View style={styles.financeRow}>
            <Text style={styles.financeLabel}>
              Comisión plataforma ({commissionPct}%)
            </Text>
            <Text style={[styles.financeValue, { color: '#DC2626' }]}>
              -${(trip.commission || 0).toLocaleString('es-CO')} COP
            </Text>
          </View>

          <View style={styles.financeRow}>
            <Text style={styles.financeLabel}>Propina recibida</Text>
            <Text style={[styles.financeValue, { color: '#D97706' }]}>
              +${(trip.tip || 0).toLocaleString('es-CO')} COP
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.financeRow}>
            <Text style={styles.netLabel}>Ganancia neta del conductor</Text>
            <Text style={styles.netValue}>
              ${(trip.driverEarnings || 0).toLocaleString('es-CO')} COP
            </Text>
          </View>

          {trip.paymentId && (
            <Text style={styles.paymentIdText}>ID de pago: {trip.paymentId}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  container: {
    padding: 16,
    gap: 14,
  },
  mapCard: {
    height: 220,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  map: { flex: 1 },
  originMarker: {
    backgroundColor: '#2563EB',
    padding: 6,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  destMarker: {
    backgroundColor: '#DC2626',
    padding: 6,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  passengerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  dateText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  ratingBox: {
    alignItems: 'flex-end',
    gap: 2,
  },
  ratingLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  pointLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  pointAddress: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  statsStrip: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  statChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    borderRadius: 8,
  },
  statChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  financeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  financeLabel: {
    fontSize: 13,
    color: '#4B5563',
  },
  financeValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  netLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
  },
  netValue: {
    fontSize: 17,
    fontWeight: '800',
    color: '#16A34A',
  },
  paymentIdText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
});
