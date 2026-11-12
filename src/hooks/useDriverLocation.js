// src/hooks/useDriverLocation.js
// AI-assisted: see docs/AI_LOG.md #9
import { useState, useEffect, useCallback, useRef } from 'react';
import { PermissionsAndroid, Platform, NativeModules } from 'react-native';
import * as ExpoLocation from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

const AVAILABILITY_STORAGE_KEY = '@uber_driver_last_availability';

/**
 * Carga @react-native-community/geolocation (obligatoria para watchPosition).
 * Si se ejecuta dentro de Expo Go donde el binario nativo RNCGeolocation no está enlazado,
 * provee un adaptador compatible con la misma API (getCurrentPosition, watchPosition, clearWatch)
 * para evitar el error de emulación sin cambiar la lógica del hook.
 */
let Geolocation;
try {
  if (!NativeModules.RNCGeolocation) {
    throw new Error('RNCGeolocation not linked in Expo Go');
  }
  Geolocation = require('@react-native-community/geolocation').default;
} catch {
  const activeWatches = new Map();
  let nextId = 1;

  Geolocation = {
    getCurrentPosition: (success, error, options) => {
      ExpoLocation.getCurrentPositionAsync({
        accuracy: options?.enableHighAccuracy
          ? ExpoLocation.Accuracy.High
          : ExpoLocation.Accuracy.Balanced,
      })
        .then(success)
        .catch((err) => error && error(err));
    },
    watchPosition: (success, error, options) => {
      const watchId = nextId++;
      let cancelled = false;

      ExpoLocation.watchPositionAsync(
        {
          accuracy: options?.enableHighAccuracy
            ? ExpoLocation.Accuracy.High
            : ExpoLocation.Accuracy.Balanced,
          distanceInterval: options?.distanceFilter ?? 10,
          timeInterval: options?.interval ?? 5000,
        },
        (pos) => {
          if (!cancelled) {
            success(pos);
          }
        }
      )
        .then((sub) => {
          if (cancelled) {
            sub.remove();
          } else {
            activeWatches.set(watchId, sub);
          }
        })
        .catch((err) => error && error(err));

      return watchId;
    },
    clearWatch: (watchId) => {
      const sub = activeWatches.get(watchId);
      if (sub) {
        sub.remove();
        activeWatches.delete(watchId);
      }
    },
  };
}

/**
 * Hook personalizado obligatorio (Secciones 3 y 7):
 * Usa @react-native-community/geolocation (watchPosition) para ubicación continua
 * mientras el conductor está Disponible y sincroniza con Firestore.
 */
export const useDriverLocation = (driverId, initialIsAvailable = false) => {
  const [isAvailable, setIsAvailable] = useState(initialIsAvailable);
  const [location, setLocation] = useState({
    latitude: 6.2442,
    longitude: -75.5812,
  });
  const [locationError, setLocationError] = useState(null);
  const lastSimulatedTimestampRef = useRef(0);

  // Solicitar permiso de GPS en Android / iOS
  const requestLocationPermission = useCallback(async () => {
    try {
      if (Platform.OS === 'android' && NativeModules.RNCGeolocation) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      }
      const { status } = await ExpoLocation.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }, []);

  // Cargar último estado de disponibilidad desde AsyncStorage (Sección 3)
  useEffect(() => {
    const loadSavedAvailability = async () => {
      try {
        const saved = await AsyncStorage.getItem(AVAILABILITY_STORAGE_KEY);
        if (saved !== null) {
          setIsAvailable(JSON.parse(saved));
        }
      } catch (e) {
        // Lectura silenciosa
      }
    };
    loadSavedAvailability();
  }, []);

  // Ubicación puntual inicial al abrir el mapa
  useEffect(() => {
    let isMounted = true;

    (async () => {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        if (isMounted) {
          setLocationError('Permiso de geolocalización denegado.');
        }
        return;
      }

      Geolocation.getCurrentPosition(
        (position) => {
          if (isMounted && position?.coords) {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          }
        },
        () => {
          if (isMounted) {
            setLocationError('Activa el GPS del dispositivo para obtener tu ubicación.');
          }
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    })();

    return () => {
      isMounted = false;
    };
  }, [requestLocationPermission]);

  // Seguimiento continuo con Geolocation.watchPosition mientras está Disponible
  useEffect(() => {
    let watchId = null;

    const startWatch = async () => {
      if (!driverId || !isAvailable) return;

      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        setLocationError('Se requiere permiso de GPS para ponerse Disponible.');
        setIsAvailable(false);
        return;
      }

      setLocationError(null);

      watchId = Geolocation.watchPosition(
        async (position) => {
          // Si hay una simulación de recorrido en curso, evitar que el GPS estático del emulador regrese el vehículo
          if (Date.now() - lastSimulatedTimestampRef.current < 20000) {
            return;
          }

          const { latitude, longitude } = position.coords;
          setLocation({ latitude, longitude });

          // Sincronizar ubicación continua del conductor en Firestore
          try {
            await updateDoc(doc(db, 'drivers', driverId), {
              location: { lat: latitude, lng: longitude },
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            setLocationError('Error al sincronizar ubicación en Firestore.');
          }
        },
        (error) => {
          setLocationError(`Error GPS: ${error?.message || 'No disponible'}`);
        },
        {
          enableHighAccuracy: true,
          distanceFilter: 10, // Cada 10 metros
          interval: 5000,     // Cada 5 segundos
          fastestInterval: 3000,
        }
      );
    };

    if (isAvailable) {
      startWatch();
    }

    // Función de limpieza obligatoria en useEffect (Sección 3):
    // Detiene watchPosition al pasar a No disponible o salir de la pantalla
    return () => {
      if (watchId !== null) {
        Geolocation.clearWatch(watchId);
      }
    };
  }, [driverId, isAvailable, requestLocationPermission]);

  const toggleAvailability = useCallback(
    async (nextState) => {
      if (!driverId) return;
      setIsAvailable(nextState);

      try {
        await AsyncStorage.setItem(AVAILABILITY_STORAGE_KEY, JSON.stringify(nextState));
        await updateDoc(doc(db, 'drivers', driverId), {
          isAvailable: nextState,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        setLocationError('No se pudo cambiar el estado de disponibilidad.');
      }
    },
    [driverId]
  );

  // Permite actualizar la coordenada del conductor durante la simulación de viaje
  const updateSimulatedLocation = useCallback(
    async (coords) => {
      if (!coords?.latitude || !coords?.longitude) return;
      lastSimulatedTimestampRef.current = Date.now();
      setLocation({ latitude: coords.latitude, longitude: coords.longitude });

      if (driverId) {
        try {
          await updateDoc(doc(db, 'drivers', driverId), {
            location: { lat: coords.latitude, lng: coords.longitude },
            updatedAt: serverTimestamp(),
          });
        } catch {
          // Ignorar error puntual de red durante simulación
        }
      }
    },
    [driverId]
  );

  return {
    isAvailable,
    location,
    locationError,
    toggleAvailability,
    updateSimulatedLocation,
  };
};
