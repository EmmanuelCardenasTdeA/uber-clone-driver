// src/screens/driver/HomeScreen.js
import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  Switch,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useRegistration } from '../../context/RegistrationContext';
import { useDriverLocation } from '../../hooks/useDriverLocation';
import { useTripRequests } from '../../hooks/useTripRequests';
import ActiveTripScreen from './ActiveTripScreen';

export default function HomeScreen() {
  const { driverId, driverProfile } = useRegistration();
  const mapRef = useRef(null);

  const {
    isAvailable,
    location,
    locationError,
    toggleAvailability,
    updateSimulatedLocation,
  } = useDriverLocation(driverId, Boolean(driverProfile?.isAvailable));

  const {
    incomingRequest,
    activeTrip,
    countdown,
    tripError,
    actionLoading,
    lastCompletedSummary,
    fcmNotificationBanner,
    simulateIncomingTrip,
    acceptTrip,
    rejectTrip,
    markArrivedAtPickup,
    startTrip,
    finishTrip,
    cancelActiveTrip,
    dismissCompletedSummary,
    dismissFcmBanner,
  } = useTripRequests({
    driverId,
    isAvailable,
    driverLocation: location,
    vehicleCategory: driverProfile?.vehicle?.category || 'economy',
  });

  // Centrar el mapa suavemente cuando cambia la coordenada del conductor
  useEffect(() => {
    if (!activeTrip && mapRef.current && location?.latitude && location?.longitude) {
      mapRef.current.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        600
      );
    }
  }, [location.latitude, location.longitude, activeTrip]);

  const centerMapOnDriver = () => {
    if (mapRef.current && location) {
      mapRef.current.animateToRegion(
        {
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
    }
  };

  // Si hay un viaje en curso ('accepted', 'arrived', 'in_progress'), mostrar la pantalla de Viaje en Curso
  if (activeTrip) {
    return (
      <ActiveTripScreen
        activeTrip={activeTrip}
        driverId={driverId}
        driverLocation={location}
        onUpdateDriverLocation={updateSimulatedLocation}
        onMarkArrived={markArrivedAtPickup}
        onStartTrip={startTrip}
        onFinishTrip={finishTrip}
        onCancelTrip={cancelActiveTrip}
        actionLoading={actionLoading}
        tripError={tripError}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Tarjeta superior de control Disponible / No disponible */}
      <View style={styles.statusHeader}>
        <View style={styles.statusTextContainer}>
          <View style={styles.statusIndicatorRow}>
            <View
              style={[
                styles.dot,
                { backgroundColor: isAvailable ? '#16A34A' : '#DC2626' },
              ]}
            />
            <Text style={styles.statusTitle}>
              {isAvailable ? 'Disponible para viajes' : 'No disponible'}
            </Text>
          </View>
          <Text style={styles.statusSubtitle}>
            {isAvailable
              ? 'Enviando ubicación en tiempo real y esperando solicitudes...'
              : 'Activa el interruptor para recibir solicitudes de viaje.'}
          </Text>
        </View>

        <Switch
          value={isAvailable}
          onValueChange={toggleAvailability}
          trackColor={{ false: '#D1D5DB', true: '#86EFAC' }}
          thumbColor={isAvailable ? '#16A34A' : '#6B7280'}
        />
      </View>

      {/* Banner de notificación push FCM (@react-native-firebase/messaging) */}
      {fcmNotificationBanner && (
        <View style={styles.fcmBanner}>
          <Ionicons name="notifications" size={18} color="#1D4ED8" />
          <Text style={styles.fcmBannerText} numberOfLines={2}>
            {fcmNotificationBanner}
          </Text>
          <TouchableOpacity onPress={dismissFcmBanner}>
            <Ionicons name="close" size={18} color="#1D4ED8" />
          </TouchableOpacity>
        </View>
      )}

      {/* Mensaje de error de GPS o de viajes debajo de la barra superior (nunca en Alert) */}
      {(locationError || tripError) && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
          <Text style={styles.errorText}>{locationError || tripError}</Text>
        </View>
      )}

      {/* Resumen de último viaje finalizado */}
      {lastCompletedSummary && (
        <View style={styles.completedBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.completedTitle}>
              ¡Viaje con {lastCompletedSummary.passengerName} finalizado!
            </Text>
            <Text style={styles.completedSub}>
              Tarifa: ${lastCompletedSummary.fare?.toLocaleString('es-CO')} • Comisión 20%: -$
              {lastCompletedSummary.commission?.toLocaleString('es-CO')} • Ganancia acreditada:{' '}
              <Text style={{ fontWeight: '800' }}>
                +${lastCompletedSummary.driverEarnings?.toLocaleString('es-CO')} COP
              </Text>
            </Text>
          </View>
          <TouchableOpacity onPress={dismissCompletedSummary}>
            <Ionicons name="close-circle" size={22} color="#065F46" />
          </TouchableOpacity>
        </View>
      )}

      {/* Mapa interactivo del conductor */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: location.latitude,
          longitude: location.longitude,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }}
        showsUserLocation={true}
        showsMyLocationButton={false}
      >
        <Marker
          coordinate={{
            latitude: location.latitude,
            longitude: location.longitude,
          }}
          title={driverProfile?.personalData?.fullName || 'Tu ubicación'}
          description={`Vehículo: ${driverProfile?.vehicle?.plate || ''}`}
        >
          <View style={[styles.carMarker, isAvailable && styles.carMarkerActive]}>
            <Ionicons name="car-sport" size={22} color="#FFFFFF" />
          </View>
        </Marker>

        {/* Si hay una solicitud entrante, mostrar marcador del punto de recogida */}
        {incomingRequest?.origin && (
          <Marker
            coordinate={{
              latitude: incomingRequest.origin.latitude,
              longitude: incomingRequest.origin.longitude,
            }}
            title={`Pasajero: ${incomingRequest.passengerName}`}
            description={incomingRequest.origin.address}
            pinColor="#2563EB"
          />
        )}
      </MapView>

      {/* Botón flotante para centrar cámara */}
      <TouchableOpacity style={styles.recenterButton} onPress={centerMapOnDriver}>
        <Ionicons name="locate" size={24} color="#111827" />
      </TouchableOpacity>

      {/* Tarjeta modal de Solicitud Entrante con cuenta regresiva de 15 segundos */}
      {incomingRequest ? (
        <View style={styles.requestCard}>
          <View style={styles.requestHeaderRow}>
            <View style={styles.requestBadge}>
              <Ionicons name="flash" size={14} color="#FFFFFF" />
              <Text style={styles.requestBadgeText}>NUEVA SOLICITUD</Text>
            </View>
            <View style={styles.timerBadge}>
              <Ionicons name="time-outline" size={16} color="#DC2626" />
              <Text style={styles.timerText}>{countdown}s</Text>
            </View>
          </View>

          <View style={styles.passengerInfoRow}>
            <Text style={styles.passengerName}>{incomingRequest.passengerName}</Text>
            <Text style={styles.passengerMeta}>
              ⭐ {incomingRequest.passengerRating} • {incomingRequest.paymentMethod}
            </Text>
          </View>

          <View style={styles.routeDetailsBox}>
            <View style={styles.routePointRow}>
              <Ionicons name="radio-button-on" size={16} color="#2563EB" />
              <Text style={styles.routePointText} numberOfLines={1}>
                Recogida: {incomingRequest.origin?.address} ({incomingRequest.pickupDistanceKm} km)
              </Text>
            </View>
            <View style={styles.routePointRow}>
              <Ionicons name="location" size={16} color="#DC2626" />
              <Text style={styles.routePointText} numberOfLines={1}>
                Destino: {incomingRequest.destination?.address} ({incomingRequest.distanceKm} km •{' '}
                {incomingRequest.durationMin} min)
              </Text>
            </View>
          </View>

          <View style={styles.farePreviewRow}>
            <View>
              <Text style={styles.farePreviewLabel}>Tarifa estimada</Text>
              <Text style={styles.farePreviewTotal}>
                ${incomingRequest.fare?.toLocaleString('es-CO')} COP
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.farePreviewLabel}>Tu ganancia neta (80%)</Text>
              <Text style={styles.farePreviewNet}>
                ${incomingRequest.driverEarnings?.toLocaleString('es-CO')} COP
              </Text>
            </View>
          </View>

          <View style={styles.requestActionsRow}>
            <TouchableOpacity
              style={styles.rejectBtn}
              onPress={rejectTrip}
              disabled={actionLoading}
            >
              <Ionicons name="close-outline" size={20} color="#DC2626" />
              <Text style={styles.rejectBtnText}>Rechazar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={acceptTrip}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="checkmark-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.acceptBtnText}>Aceptar viaje</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* Panel inferior informativo del conductor autorizado */
        <View style={styles.bottomCard}>
          <View style={styles.driverRow}>
            <Ionicons name="shield-checkmark" size={24} color="#16A34A" />
            <View style={{ flex: 1 }}>
              <Text style={styles.driverName}>
                {driverProfile?.personalData?.fullName} • {driverProfile?.vehicle?.plate}
              </Text>
              <Text style={styles.vehicleDetails}>
                {driverProfile?.vehicle?.brand} {driverProfile?.vehicle?.model} • Categoría:{' '}
                {driverProfile?.vehicle?.category?.toUpperCase()}
              </Text>
            </View>
            <View style={styles.balanceBox}>
              <Text style={styles.balanceLabel}>Saldo</Text>
              <Text style={styles.balanceValue}>
                ${(driverProfile?.balance || 0).toLocaleString('es-CO')}
              </Text>
            </View>
          </View>

          {/* Botón para simular la llegada de una solicitud de viaje */}
          <TouchableOpacity
            style={[
              styles.simulateRequestBtn,
              !isAvailable && styles.simulateRequestBtnDisabled,
            ]}
            onPress={simulateIncomingTrip}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="sparkles-outline" size={18} color="#FFFFFF" />
                <Text style={styles.simulateRequestBtnText}>
                  {isAvailable
                    ? 'Simular nueva solicitud de viaje'
                    : 'Ponte Disponible para simular un viaje'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  statusTextContainer: { flex: 1, paddingRight: 12 },
  statusIndicatorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  statusSubtitle: { color: '#9CA3AF', fontSize: 12, marginTop: 2 },
  fcmBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
  },
  fcmBannerText: { color: '#1E40AF', fontSize: 12, fontWeight: '600', flex: 1 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
  },
  errorText: { color: '#DC2626', fontSize: 12, flex: 1 },
  completedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#A7F3D0',
  },
  completedTitle: { color: '#065F46', fontSize: 13, fontWeight: '700' },
  completedSub: { color: '#047857', fontSize: 12, marginTop: 2 },
  map: { flex: 1 },
  carMarker: {
    backgroundColor: '#4B5563',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  carMarkerActive: {
    backgroundColor: '#16A34A',
  },
  recenterButton: {
    position: 'absolute',
    right: 16,
    bottom: 155,
    backgroundColor: '#FFFFFF',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  bottomCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    elevation: 8,
    gap: 12,
  },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  driverName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  vehicleDetails: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  balanceBox: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'flex-end',
  },
  balanceLabel: { fontSize: 11, color: '#6B7280' },
  balanceValue: { fontSize: 14, fontWeight: '700', color: '#111827' },
  simulateRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderRadius: 10,
  },
  simulateRequestBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  simulateRequestBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  requestCard: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 12,
    gap: 10,
  },
  requestHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  requestBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  timerText: {
    color: '#DC2626',
    fontWeight: '800',
    fontSize: 13,
  },
  passengerInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  passengerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
  },
  passengerMeta: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600',
  },
  routeDetailsBox: {
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  routePointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  routePointText: {
    fontSize: 13,
    color: '#1F2937',
    flex: 1,
  },
  farePreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  farePreviewLabel: {
    fontSize: 11,
    color: '#6B7280',
  },
  farePreviewTotal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  farePreviewNet: {
    fontSize: 16,
    fontWeight: '800',
    color: '#16A34A',
  },
  requestActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  rejectBtnText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 14,
  },
  acceptBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#16A34A',
  },
  acceptBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
