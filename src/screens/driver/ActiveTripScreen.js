// src/screens/driver/ActiveTripScreen.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { syncTripDriverLocationInDB, buildInterpolatedRoute } from '../../services/tripServices';
import { calculateFare } from '../../utils/calculateFare';

export default function ActiveTripScreen({
  activeTrip,
  driverId,
  driverLocation,
  onUpdateDriverLocation,
  onMarkArrived,
  onStartTrip,
  onFinishTrip,
  onCancelTrip,
  actionLoading,
  tripError,
}) {
  const mapRef = useRef(null);
  const simIntervalRef = useRef(null);

  const [isSimulatingMove, setIsSimulatingMove] = useState(false);
  const [simStepIndex, setSimStepIndex] = useState(0);
  const [tipInput, setTipInput] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  // Coordenadas de la ruta activa según la etapa del viaje
  const activeRouteCoords = useMemo(() => {
    if (!activeTrip) return [];
    if (activeTrip.status === 'accepted') {
      if (activeTrip.pickupCoordinates?.length > 1) {
        return activeTrip.pickupCoordinates;
      }
      return buildInterpolatedRoute(
        driverLocation,
        activeTrip.origin,
        12
      );
    }
    if (activeTrip.routeCoordinates?.length > 1) {
      return activeTrip.routeCoordinates;
    }
    return buildInterpolatedRoute(
      activeTrip.origin,
      activeTrip.destination,
      16
    );
  }, [activeTrip?.id, activeTrip?.status]);

  // Reiniciar índice de simulación cuando cambia la etapa del viaje
  useEffect(() => {
    setIsSimulatingMove(false);
    setSimStepIndex(0);
    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
      simIntervalRef.current = null;
    }
  }, [activeTrip?.status, activeTrip?.id]);

  // Ajustar cámara del mapa para encuadrar la ruta activa
  useEffect(() => {
    if (mapRef.current && activeRouteCoords.length > 1) {
      mapRef.current.fitToCoordinates(activeRouteCoords, {
        edgePadding: { top: 70, right: 60, bottom: 260, left: 60 },
        animated: true,
      });
    }
  }, [activeRouteCoords]);

  // Intervalo de simulación paso a paso sobre la polilínea sincronizado con Firestore (onSnapshot)
  useEffect(() => {
    if (!isSimulatingMove || activeRouteCoords.length === 0) {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
      return;
    }

    simIntervalRef.current = setInterval(() => {
      setSimStepIndex((prevIndex) => {
        const nextIndex = prevIndex + 1;
        if (nextIndex >= activeRouteCoords.length) {
          clearInterval(simIntervalRef.current);
          simIntervalRef.current = null;
          setIsSimulatingMove(false);
          return prevIndex;
        }

        const nextCoord = activeRouteCoords[nextIndex];
        if (nextCoord) {
          onUpdateDriverLocation?.(nextCoord);
          syncTripDriverLocationInDB(activeTrip.id, driverId, nextCoord).catch(() => {});
        }
        return nextIndex;
      });
    }, 1200);

    // Cleanup obligatorio
    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
        simIntervalRef.current = null;
      }
    };
  }, [isSimulatingMove, activeRouteCoords, activeTrip?.id, driverId, onUpdateDriverLocation]);

  // Cálculo dinámico de tarifa incluyendo propina en tiempo real
  const liveFareBreakdown = useMemo(() => {
    return calculateFare({
      distanceKm: activeTrip?.distanceKm || 0,
      durationMin: activeTrip?.durationMin || 0,
      category: activeTrip?.category || 'economy',
      tip: Number(tipInput) || 0,
    });
  }, [activeTrip?.distanceKm, activeTrip?.durationMin, activeTrip?.category, tipInput]);

  if (!activeTrip) return null;

  const currentCarPosition = activeTrip.driverLocation?.latitude
    ? activeTrip.driverLocation
    : driverLocation;

  const progressPercent =
    activeRouteCoords.length > 1
      ? Math.round((simStepIndex / (activeRouteCoords.length - 1)) * 100)
      : 0;

  const getStageHeader = () => {
    switch (activeTrip.status) {
      case 'accepted':
        return {
          badge: 'EN CAMINO A RECOGER',
          color: '#2563EB',
          instruction: `Dirígete a: ${activeTrip.origin?.address}`,
        };
      case 'arrived':
        return {
          badge: 'EN PUNTO DE RECOGIDA',
          color: '#D97706',
          instruction: `Esperando a ${activeTrip.passengerName} en ${activeTrip.origin?.address}`,
        };
      case 'in_progress':
        return {
          badge: 'VIAJE EN CURSO',
          color: '#16A34A',
          instruction: `Destino: ${activeTrip.destination?.address}`,
        };
      default:
        return {
          badge: 'VIAJE ACTIVO',
          color: '#111827',
          instruction: '',
        };
    }
  };

  const stageInfo = getStageHeader();

  return (
    <View style={styles.container}>
      {/* Banner superior de etapa del viaje */}
      <View style={[styles.stageBanner, { backgroundColor: stageInfo.color }]}>
        <View style={styles.stageRow}>
          <Ionicons name="navigate-circle-outline" size={22} color="#FFFFFF" />
          <Text style={styles.stageBadge}>{stageInfo.badge}</Text>
          <Text style={styles.progressText}>{progressPercent}% recorrido</Text>
        </View>
        <Text style={styles.stageInstruction} numberOfLines={1}>
          {stageInfo.instruction}
        </Text>
      </View>

      {tripError && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
          <Text style={styles.errorText}>{tripError}</Text>
        </View>
      )}

      {/* Mapa del viaje en curso con ruta y marcadores */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: currentCarPosition.latitude,
          longitude: currentCarPosition.longitude,
          latitudeDelta: 0.025,
          longitudeDelta: 0.025,
        }}
      >
        {/* Polilínea de la ruta */}
        {activeRouteCoords.length > 1 && (
          <Polyline
            coordinates={activeRouteCoords}
            strokeWidth={5}
            strokeColor={activeTrip.status === 'accepted' ? '#2563EB' : '#16A34A'}
          />
        )}

        {/* Marcador de Origen (Pasajero) */}
        {activeTrip.origin && (
          <Marker
            coordinate={{
              latitude: activeTrip.origin.latitude,
              longitude: activeTrip.origin.longitude,
            }}
            title="Punto de recogida"
            description={activeTrip.origin.address}
          >
            <View style={styles.originMarker}>
              <Ionicons name="person" size={16} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Marcador de Destino */}
        {activeTrip.destination && (
          <Marker
            coordinate={{
              latitude: activeTrip.destination.latitude,
              longitude: activeTrip.destination.longitude,
            }}
            title="Destino final"
            description={activeTrip.destination.address}
          >
            <View style={styles.destMarker}>
              <Ionicons name="flag" size={16} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Marcador del Vehículo del Conductor en tiempo real */}
        <Marker
          coordinate={{
            latitude: currentCarPosition.latitude,
            longitude: currentCarPosition.longitude,
          }}
          title="Tu vehículo"
        >
          <View style={styles.driverCarMarker}>
            <Ionicons name="car-sport" size={20} color="#FFFFFF" />
          </View>
        </Marker>
      </MapView>

      {/* Panel inferior de control del viaje y simulación */}
      <View style={styles.bottomSheet}>
        <View style={styles.passengerHeader}>
          <View style={styles.passengerAvatar}>
            <Ionicons name="person-outline" size={22} color="#111827" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.passengerName}>{activeTrip.passengerName}</Text>
            <Text style={styles.tripMeta}>
              ⭐ {activeTrip.passengerRating} • {activeTrip.paymentMethod} •{' '}
              {activeTrip.distanceKm} km ({activeTrip.durationMin} min)
            </Text>
          </View>
          <View style={styles.earningsPill}>
            <Text style={styles.earningsPillLabel}>Ganancia neta</Text>
            <Text style={styles.earningsPillValue}>
              ${liveFareBreakdown.driverEarnings.toLocaleString('es-CO')}
            </Text>
          </View>
        </View>

        {/* Botón de simulación de movimiento GPS a lo largo de la ruta */}
        {(activeTrip.status === 'accepted' || activeTrip.status === 'in_progress') && (
          <TouchableOpacity
            style={[
              styles.simButton,
              isSimulatingMove && styles.simButtonActive,
            ]}
            onPress={() => setIsSimulatingMove((prev) => !prev)}
          >
            <Ionicons
              name={isSimulatingMove ? 'pause-circle-outline' : 'play-circle-outline'}
              size={20}
              color={isSimulatingMove ? '#1D4ED8' : '#111827'}
            />
            <Text
              style={[
                styles.simButtonText,
                isSimulatingMove && { color: '#1D4ED8' },
              ]}
            >
              {isSimulatingMove
                ? 'Pausar simulación GPS en tiempo real'
                : activeTrip.status === 'accepted'
                ? 'Simular recorrido hacia el pasajero'
                : 'Simular recorrido hacia el destino'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Desglose y propina en etapa in_progress */}
        {activeTrip.status === 'in_progress' && (
          <View style={styles.fareBreakdownBox}>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Tarifa base calculada:</Text>
              <Text style={styles.fareVal}>
                ${liveFareBreakdown.fare.toLocaleString('es-CO')} COP
              </Text>
            </View>
            <View style={styles.fareRow}>
              <Text style={styles.fareLabel}>Comisión app (20%):</Text>
              <Text style={[styles.fareVal, { color: '#DC2626' }]}>
                -${liveFareBreakdown.commission.toLocaleString('es-CO')} COP
              </Text>
            </View>
            <View style={styles.tipInputRow}>
              <Text style={styles.fareLabel}>Propina opcional (COP):</Text>
              <TextInput
                style={styles.tipInput}
                keyboardType="numeric"
                placeholder="0"
                value={tipInput}
                onChangeText={(txt) => setTipInput(txt.replace(/[^0-9]/g, ''))}
              />
            </View>
          </View>
        )}

        {/* Botón de acción principal según estado del viaje */}
        {activeTrip.status === 'accepted' && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: '#2563EB' }]}
            onPress={onMarkArrived}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="location-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Llegué al punto de recogida</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {activeTrip.status === 'arrived' && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: '#D97706' }]}
            onPress={onStartTrip}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="car-outline" size={20} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Iniciar viaje hacia el destino</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {activeTrip.status === 'in_progress' && (
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: '#16A34A' }]}
            onPress={() => onFinishTrip(Number(tipInput) || 0)}
            disabled={actionLoading}
          >
            {actionLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-done-circle-outline" size={22} color="#FFFFFF" />
                <Text style={styles.primaryBtnText}>Finalizar viaje y cobrar</Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Cancelación sin usar Alert nativo */}
        {!showCancelConfirm ? (
          <TouchableOpacity
            style={styles.cancelLink}
            onPress={() => setShowCancelConfirm(true)}
          >
            <Text style={styles.cancelLinkText}>Cancelar viaje</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.cancelConfirmRow}>
            <Text style={styles.cancelConfirmLabel}>¿Confirmas cancelar el viaje?</Text>
            <TouchableOpacity
              style={styles.cancelConfirmYes}
              onPress={() => onCancelTrip('Cancelado por el conductor en ruta')}
            >
              <Text style={styles.cancelConfirmYesText}>Sí, cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelConfirmNo}
              onPress={() => setShowCancelConfirm(false)}
            >
              <Text style={styles.cancelConfirmNoText}>No</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  stageBanner: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stageBadge: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
    flex: 1,
  },
  progressText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
  },
  stageInstruction: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
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
  map: { flex: 1 },
  originMarker: {
    backgroundColor: '#2563EB',
    padding: 7,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  destMarker: {
    backgroundColor: '#DC2626',
    padding: 7,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  driverCarMarker: {
    backgroundColor: '#111827',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#16A34A',
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
    gap: 10,
  },
  passengerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  passengerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  tripMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  earningsPill: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'flex-end',
  },
  earningsPillLabel: {
    fontSize: 10,
    color: '#047857',
    fontWeight: '600',
  },
  earningsPillValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#065F46',
  },
  simButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  simButtonActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  simButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  fareBreakdownBox: {
    backgroundColor: '#F9FAFB',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  fareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fareLabel: {
    fontSize: 12,
    color: '#4B5563',
  },
  fareVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
  },
  tipInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  tipInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    width: 110,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '600',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  cancelLinkText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  cancelConfirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelConfirmLabel: {
    fontSize: 12,
    color: '#991B1B',
    fontWeight: '600',
    flex: 1,
  },
  cancelConfirmYes: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 8,
  },
  cancelConfirmYesText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  cancelConfirmNo: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  cancelConfirmNoText: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '600',
  },
});
