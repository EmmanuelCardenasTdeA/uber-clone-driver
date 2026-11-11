import React,{useRef, useEffect} from "react";
import { View, Text, Switch, StyleSheet, TouchableOpacity } from "react-native";
import MapView, {Marker} from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import useRegistration from '../../context/RegistrationContext';
import { useDriverLocation } from "../../hooks/useDriverLocation";

export default function HomeScreen() {
  const { driverId, driverProfile } = useRegistration();
  const mapRef = useRef(null);

  const { isAvailable, location, locationError, toggleAvailability } = useDriverLocation(
    driverId,
    Boolean(driverProfile?.isAvailable)
  );

  // Centrar el mapa cuando cambia la coordenada del conductor
  useEffect(() => {
    if (mapRef.current && location?.latitude && location?.longitude) {
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
  }, [location.latitude, location.longitude]);

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

      {/* Mensaje de error de GPS debajo de la barra superior (nunca en Alert) */}
      {locationError && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
          <Text style={styles.errorText}>{locationError}</Text>
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
      </MapView>

      {/* Botón flotante para centrar cámara */}
      <TouchableOpacity style={styles.recenterButton} onPress={centerMapOnDriver}>
        <Ionicons name="locate" size={24} color="#111827" />
      </TouchableOpacity>

      {/* Panel inferior informativo del conductor autorizado */}
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
      </View>
    </View>
  );
};

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
    bottom: 105,
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
});