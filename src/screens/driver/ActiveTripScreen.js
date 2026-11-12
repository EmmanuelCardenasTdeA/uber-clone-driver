// src/screens/driver/ActiveTripScreen.js
import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  syncTripDriverLocationInDB,
  buildInterpolatedRoute,
  formatPaymentMethodLabel,
} from '../../services/tripServices';
import { calculateFare } from '../../utils/calculateFare';

export default function ActiveTripScreen({
  activeTrip,
  driverId,
  driverLocation,
  onUpdateDriverLocation,
  onMarkDriverArriving,
  onStartTripWithPassenger,
  onFinishTrip,
  onConfirmPayment,
  onCancelTrip,
  actionLoading,
  tripError,
}) {
  const mapRef = useRef(null);
  const simIntervalRef = useRef(null);
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();

  const [isSimulatingMove, setIsSimulatingMove] = useState(false);
  const [simStepIndex, setSimStepIndex] = useState(0);
  const [tipInput, setTipInput] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const isPickupStage =
    activeTrip?.status === 'accepted' || activeTrip?.status === 'driver_arriving';

  // Coordenadas de la ruta activa según la etapa del viaje (Sección 3.3: al tocar Pasajero a bordo, la ruta cambia hacia el destino)
  const activeRouteCoords = useMemo(() => {
    if (!activeTrip) return [];
    if (isPickupStage) {
      if (activeTrip.pickupCoordinates?.length > 1) {
        return activeTrip.pickupCoordinates;
      }
      return buildInterpolatedRoute(driverLocation, activeTrip.origin, 12);
    }
    if (activeTrip.routeCoordinates?.length > 1) {
      return activeTrip.routeCoordinates;
    }
    return buildInterpolatedRoute(activeTrip.origin, activeTrip.destination, 16);
  }, [activeTrip?.id, isPickupStage]);

  // Reiniciar índice de simulación cuando cambia la etapa del viaje
  useEffect(() => {
    setIsSimulatingMove(false);
    setSimStepIndex(0);
    setShowCancelConfirm(false);
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
      tip: Number(tipInput) || activeTrip?.tip || 0,
    });
  }, [activeTrip?.distanceKm, activeTrip?.durationMin, activeTrip?.category, activeTrip?.tip, tipInput]);

  if (!activeTrip) return null;

  const currentCarPosition = {
    latitude:
      activeTrip.driverLocation?.latitude ??
      activeTrip.driverLocation?.lat ??
      driverLocation.latitude,
    longitude:
      activeTrip.driverLocation?.longitude ??
      activeTrip.driverLocation?.lng ??
      driverLocation.longitude,
  };

  const progressPercent =
    activeRouteCoords.length > 1
      ? Math.round((simStepIndex / (activeRouteCoords.length - 1)) * 100)
      : 0;

  const getStageHeader = () => {
    switch (activeTrip.status) {
      case 'accepted':
        return {
          badge: 'SOLICITUD ACEPTADA',
          color: '#2563EB',
          instruction: `Recoge a ${activeTrip.passengerName} en: ${activeTrip.origin?.address}`,
        };
      case 'driver_arriving':
        return {
          badge: 'EN CAMINO A RECOGER',
          color: '#D97706',
          instruction: `Punto de recogida: ${activeTrip.origin?.address}`,
        };
      case 'in_progress':
        return {
          badge: 'PASAJERO A BORDO',
          color: '#16A34A',
          instruction: `Destino: ${activeTrip.destination?.address}`,
        };
      case 'completed':
        return {
          badge: 'VIAJE FINALIZADO - COBRO',
          color: '#111827',
          instruction: `Confirma el cobro de ${formatPaymentMethodLabel(activeTrip.paymentMethod)}`,
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
  const bottomSafePadding = Math.max(insets.bottom + 10, 16);
  const canCancel =
    activeTrip.status === 'accepted' || activeTrip.status === 'driver_arriving';

  const originCoord = {
    latitude: activeTrip.origin?.latitude ?? activeTrip.origin?.lat,
    longitude: activeTrip.origin?.longitude ?? activeTrip.origin?.lng,
  };

  const destCoord = {
    latitude: activeTrip.destination?.latitude ?? activeTrip.destination?.lat,
    longitude: activeTrip.destination?.longitude ?? activeTrip.destination?.lng,
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 75}
    >
      {/* Banner superior de etapa del viaje */}
      <View style={[styles.stageBanner, { backgroundColor: stageInfo.color }]}>
        <View style={styles.stageRow}>
          <Ionicons name="navigate-circle-outline" size={22} color="#FFFFFF" />
          <Text style={styles.stageBadge}>{stageInfo.badge}</Text>
          {activeTrip.status !== 'completed' && (
            <Text style={styles.progressText}>{progressPercent}%</Text>
          )}
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
            strokeColor={isPickupStage ? '#2563EB' : '#16A34A'}
          />
        )}

        {/* Marcador de Origen (Pasajero) */}
        {originCoord.latitude && (
          <Marker
            coordinate={originCoord}
            title="Punto de recogida"
            description={activeTrip.origin?.address}
          >
            <View style={styles.originMarker}>
              <Ionicons name="person" size={16} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Marcador de Destino */}
        {destCoord.latitude && (
          <Marker
            coordinate={destCoord}
            title="Destino final"
            description={activeTrip.destination?.address}
          >
            <View style={styles.destMarker}>
              <Ionicons name="flag" size={16} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {/* Marcador del Vehículo del Conductor en tiempo real */}
        <Marker coordinate={currentCarPosition} title="Tu vehículo">
          <View style={styles.driverCarMarker}>
            <Ionicons name="car-sport" size={20} color="#FFFFFF" />
          </View>
        </Marker>
      </MapView>

      {/* Panel inferior adaptable al teclado y al borde seguro inferior */}
      <View
        style={[
          styles.bottomSheet,
          {
            maxHeight: screenHeight * 0.56,
            paddingBottom: bottomSafePadding,
          },
        ]}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.bottomSheetContent}
        >
          <View style={styles.passengerHeader}>
            <View style={styles.passengerAvatar}>
              <Ionicons name="person-outline" size={22} color="#111827" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.passengerName} numberOfLines={1}>
                {activeTrip.passengerName}
              </Text>
              <View style={styles.tripMetaRow}>
                <Ionicons name="star" size={13} color="#F59E0B" />
                <Text style={styles.tripMeta} numberOfLines={1}>
                  {activeTrip.rating ?? activeTrip.passengerRating} •{' '}
                  {formatPaymentMethodLabel(activeTrip.paymentMethod)} •{' '}
                  {activeTrip.distanceKm} km ({activeTrip.durationMin} min)
                </Text>
              </View>
            </View>
            <View style={styles.earningsPill}>
              <Text style={styles.earningsPillLabel}>Ganancia neta</Text>
              <Text style={styles.earningsPillValue}>
                ${liveFareBreakdown.driverEarnings.toLocaleString('es-CO')}
              </Text>
            </View>
          </View>

          {/* Botón de simulación de movimiento GPS a lo largo de la ruta */}
          {(isPickupStage || activeTrip.status === 'in_progress') && (
            <TouchableOpacity
              style={[styles.simButton, isSimulatingMove && styles.simButtonActive]}
              onPress={() => {
                if (activeTrip.status === 'accepted' && !isSimulatingMove) {
                  onMarkDriverArriving?.();
                }
                setIsSimulatingMove((prev) => !prev);
              }}
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
                  : isPickupStage
                  ? 'Simular recorrido hacia el punto de recogida'
                  : 'Simular recorrido hacia el destino'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Desglose y propina en etapa in_progress o completed */}
          {(activeTrip.status === 'in_progress' || activeTrip.status === 'completed') && (
            <View style={styles.fareBreakdownBox}>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>Tarifa calculada:</Text>
                <Text style={styles.fareVal}>
                  ${liveFareBreakdown.fare.toLocaleString('es-CO')} COP
                </Text>
              </View>
              <View style={styles.fareRow}>
                <Text style={styles.fareLabel}>
                  Comisión plataforma ({Math.round((activeTrip.commissionRate || 0.2) * 100)}%):
                </Text>
                <Text style={[styles.fareVal, { color: '#DC2626' }]}>
                  -${liveFareBreakdown.commission.toLocaleString('es-CO')} COP
                </Text>
              </View>
              {activeTrip.status === 'in_progress' ? (
                <View style={styles.tipInputRow}>
                  <Text style={styles.fareLabel}>Propina opcional (COP):</Text>
                  <TextInput
                    style={styles.tipInput}
                    keyboardType="numeric"
                    placeholder="0"
                    returnKeyType="done"
                    value={tipInput}
                    onChangeText={(txt) => setTipInput(txt.replace(/[^0-9]/g, ''))}
                  />
                </View>
              ) : (
                <View style={styles.fareRow}>
                  <Text style={styles.fareLabel}>Propina:</Text>
                  <Text style={styles.fareVal}>
                    +${(activeTrip.tip || 0).toLocaleString('es-CO')} COP
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Botones de transición de los 7 estados oficiales (Sección 3) */}
          {activeTrip.status === 'accepted' && (
            <View style={styles.actionGroup}>
              <TouchableOpacity
                style={[styles.secondaryBtn]}
                onPress={onMarkDriverArriving}
                disabled={actionLoading}
              >
                <Ionicons name="navigate-outline" size={18} color="#1D4ED8" />
                <Text style={styles.secondaryBtnText}>
                  En camino al punto de recogida
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#2563EB' }]}
                onPress={onStartTripWithPassenger}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
                    <Text style={styles.primaryBtnText}>Pasajero a bordo</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {activeTrip.status === 'driver_arriving' && (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: '#D97706' }]}
              onPress={onStartTripWithPassenger}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Pasajero a bordo</Text>
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
                  <Ionicons name="flag-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Finalizar viaje</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {activeTrip.status === 'completed' && (
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: '#111827' }]}
              onPress={() => onConfirmPayment({ paymentStatus: 'approved' })}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="cash-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>
                    {activeTrip.paymentMethod === 'cash'
                      ? 'Confirmar cobro en Efectivo recibido'
                      : `Confirmar pago (${formatPaymentMethodLabel(activeTrip.paymentMethod)})`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Cancelación permitida SOLO antes de 'in_progress' (Sección 3) */}
          {canCancel && (
            <>
              {!showCancelConfirm ? (
                <TouchableOpacity
                  style={styles.cancelLink}
                  onPress={() => setShowCancelConfirm(true)}
                >
                  <Text style={styles.cancelLinkText}>Cancelar viaje</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.cancelConfirmRow}>
                  <Text style={styles.cancelConfirmLabel}>
                    ¿Confirmas cancelar antes de abordar?
                  </Text>
                  <TouchableOpacity
                    style={styles.cancelConfirmYes}
                    onPress={() => onCancelTrip('Cancelado por el conductor antes de in_progress')}
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
            </>
          )}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
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
    paddingTop: 14,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 10,
  },
  bottomSheetContent: {
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
  tripMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  tripMeta: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
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
  actionGroup: {
    gap: 8,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  secondaryBtnText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '700',
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
