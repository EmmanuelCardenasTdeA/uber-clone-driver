// src/hooks/useTripRequests.js
import { useState, useEffect, useCallback, useRef } from 'react';
import { NativeModules } from 'react-native';
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  createSimulatedTripRequest,
  acceptTripInDB,
  rejectTripInDB,
  updateTripStatusInDB,
  completeTripInDB,
} from '../services/tripServices';

const REQUEST_TIMEOUT_SECONDS = 15;

/**
 * Obtiene la instancia de @react-native-firebase/messaging (API obligatoria).
 * Si se ejecuta en Expo Go (sin el binario nativo RNFBMessagingModule enlazado),
 * evita fallos de ejecución y mantiene activa la sincronización en tiempo real por onSnapshot.
 */
const getMessagingInstance = () => {
  try {
    if (!NativeModules.RNFBMessagingModule && !NativeModules.RNFBAppModule) {
      return null;
    }
    const messaging = require('@react-native-firebase/messaging').default;
    return messaging();
  } catch {
    return null;
  }
};

// Handler de notificaciones con la app en segundo plano (FCM @react-native-firebase/messaging)
try {
  const messagingInstance = getMessagingInstance();
  if (messagingInstance) {
    messagingInstance.setBackgroundMessageHandler(async (remoteMessage) => {
      // Procesamiento silencioso de nueva solicitud de viaje en background
      return Promise.resolve(remoteMessage);
    });
  }
} catch {
  // Ignorar en entorno Expo Go
}

/**
 * Hook personalizado useTripRequests:
 * - Configura Firebase Cloud Messaging (@react-native-firebase/messaging) para notificaciones push.
 * - Escucha en tiempo real (Firestore onSnapshot) las solicitudes entrantes y el viaje en curso.
 * - Gestiona el temporizador de 15 segundos para aceptar o rechazar solicitudes.
 */
export const useTripRequests = ({
  driverId,
  isAvailable,
  driverLocation,
  vehicleCategory = 'economy',
}) => {
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [activeTrip, setActiveTrip] = useState(null);
  const [countdown, setCountdown] = useState(REQUEST_TIMEOUT_SECONDS);
  const [tripError, setTripError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [lastCompletedSummary, setLastCompletedSummary] = useState(null);
  const [fcmNotificationBanner, setFcmNotificationBanner] = useState(null);

  const timerRef = useRef(null);

  // 1. Registro de token y listener de Firebase Cloud Messaging (@react-native-firebase/messaging)
  useEffect(() => {
    if (!driverId) return;

    let unsubscribeOnMessage = null;
    const messagingInstance = getMessagingInstance();

    if (messagingInstance) {
      (async () => {
        try {
          const authStatus = await messagingInstance.requestPermission();
          if (authStatus === 1 || authStatus === 2) {
            const fcmToken = await messagingInstance.getToken();
            if (fcmToken) {
              await updateDoc(doc(db, 'drivers', driverId), {
                fcmToken,
                updatedAt: serverTimestamp(),
              });
            }
          }
        } catch {
          // Continuar si el dispositivo no tiene Google Play Services o está en Expo Go
        }
      })();

      unsubscribeOnMessage = messagingInstance.onMessage(async (remoteMessage) => {
        const title = remoteMessage?.notification?.title || 'Nueva solicitud de viaje';
        const body =
          remoteMessage?.notification?.body || 'Tienes un pasajero cercano esperando confirmación.';
        setFcmNotificationBanner(`${title}: ${body}`);
      });
    }

    return () => {
      if (unsubscribeOnMessage) {
        unsubscribeOnMessage();
      }
    };
  }, [driverId]);

  // 2. Suscripción en tiempo real a Firestore (onSnapshot) para solicitudes y viaje en curso
  useEffect(() => {
    if (!driverId) {
      setIncomingRequest(null);
      setActiveTrip(null);
      return;
    }

    const tripsQuery = query(
      collection(db, 'trips'),
      where('driverId', '==', driverId)
    );

    const unsubscribe = onSnapshot(
      tripsQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        // Prioridad 1: Viaje actualmente en curso ('accepted', 'arrived', 'in_progress')
        const ongoing = docs.find((t) =>
          ['accepted', 'arrived', 'in_progress'].includes(t.status)
        );

        if (ongoing) {
          setActiveTrip(ongoing);
          setIncomingRequest(null);
          return;
        }

        setActiveTrip(null);

        // Prioridad 2: Solicitud entrante ('requested') solo si el conductor está Disponible
        if (isAvailable) {
          const requested = docs.find((t) => t.status === 'requested');
          setIncomingRequest(requested || null);
        } else {
          setIncomingRequest(null);
        }
      },
      () => {
        setTripError('Error al sincronizar los viajes en tiempo real.');
      }
    );

    // Función de limpieza obligatoria en useEffect
    return () => {
      unsubscribe();
    };
  }, [driverId, isAvailable]);

  // 3. Temporizador de 15 segundos para responder una solicitud entrante
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!incomingRequest?.id) {
      setCountdown(REQUEST_TIMEOUT_SECONDS);
      return;
    }

    setCountdown(REQUEST_TIMEOUT_SECONDS);

    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          // Auto-rechazar por expiración de tiempo
          rejectTripInDB(incomingRequest.id, 'expired').catch(() => {});
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Cleanup obligatorio del intervalo
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [incomingRequest?.id]);

  // Simular la llegada de una nueva solicitud de viaje
  const simulateIncomingTrip = useCallback(async () => {
    if (!driverId) return;
    if (!isAvailable) {
      setTripError('Debes ponerte Disponible para recibir o simular solicitudes de viaje.');
      return;
    }

    setTripError(null);
    setLastCompletedSummary(null);
    setActionLoading(true);
    try {
      const created = await createSimulatedTripRequest({
        driverId,
        driverLocation,
        category: vehicleCategory || 'economy',
      });
      setFcmNotificationBanner(
        `🔔 Notificación FCM: Nueva solicitud de ${created.passengerName} (${created.origin.address})`
      );
    } catch (error) {
      setTripError('No se pudo generar la solicitud simulada.');
    } finally {
      setActionLoading(false);
    }
  }, [driverId, isAvailable, driverLocation, vehicleCategory]);

  // Aceptar solicitud entrante
  const acceptTrip = useCallback(async () => {
    if (!incomingRequest?.id) return;
    setTripError(null);
    setActionLoading(true);
    try {
      await acceptTripInDB(incomingRequest.id, driverLocation);
      setFcmNotificationBanner(null);
    } catch {
      setTripError('No se pudo aceptar el viaje.');
    } finally {
      setActionLoading(false);
    }
  }, [incomingRequest?.id, driverLocation]);

  // Rechazar solicitud entrante
  const rejectTrip = useCallback(async () => {
    if (!incomingRequest?.id) return;
    setTripError(null);
    setActionLoading(true);
    try {
      await rejectTripInDB(incomingRequest.id, 'rejected');
      setFcmNotificationBanner(null);
    } catch {
      setTripError('No se pudo rechazar la solicitud.');
    } finally {
      setActionLoading(false);
    }
  }, [incomingRequest?.id]);

  // Marcar llegada al punto de recogida ('arrived')
  const markArrivedAtPickup = useCallback(async () => {
    if (!activeTrip?.id) return;
    setTripError(null);
    setActionLoading(true);
    try {
      await updateTripStatusInDB(activeTrip.id, 'arrived', {
        arrivedAt: serverTimestamp(),
      });
    } catch {
      setTripError('No se pudo actualizar el estado a Llegada.');
    } finally {
      setActionLoading(false);
    }
  }, [activeTrip?.id]);

  // Iniciar viaje con el pasajero a bordo ('in_progress')
  const startTrip = useCallback(async () => {
    if (!activeTrip?.id) return;
    setTripError(null);
    setActionLoading(true);
    try {
      await updateTripStatusInDB(activeTrip.id, 'in_progress', {
        startedAt: serverTimestamp(),
      });
    } catch {
      setTripError('No se pudo iniciar el viaje.');
    } finally {
      setActionLoading(false);
    }
  }, [activeTrip?.id]);

  // Finalizar viaje y acreditar ganancias ('completed')
  const finishTrip = useCallback(
    async (tipAmount = 0) => {
      if (!activeTrip?.id || !driverId) return null;
      setTripError(null);
      setActionLoading(true);
      try {
        const breakdown = await completeTripInDB({
          tripId: activeTrip.id,
          driverId,
          distanceKm: activeTrip.distanceKm,
          durationMin: activeTrip.durationMin,
          category: activeTrip.category || vehicleCategory || 'economy',
          tip: tipAmount,
        });
        setLastCompletedSummary({
          passengerName: activeTrip.passengerName,
          distanceKm: activeTrip.distanceKm,
          durationMin: activeTrip.durationMin,
          ...breakdown,
          tip: Math.max(0, Math.round(Number(tipAmount) || 0)),
        });
        return breakdown;
      } catch {
        setTripError('No se pudo finalizar el viaje.');
        return null;
      } finally {
        setActionLoading(false);
      }
    },
    [activeTrip, driverId, vehicleCategory]
  );

  // Cancelar viaje en curso ('cancelled')
  const cancelActiveTrip = useCallback(
    async (reason = 'Cancelado por el conductor') => {
      if (!activeTrip?.id) return;
      setTripError(null);
      setActionLoading(true);
      try {
        await updateTripStatusInDB(activeTrip.id, 'cancelled', {
          cancelReason: reason,
          cancelledAt: serverTimestamp(),
        });
      } catch {
        setTripError('No se pudo cancelar el viaje.');
      } finally {
        setActionLoading(false);
      }
    },
    [activeTrip?.id]
  );

  const dismissCompletedSummary = useCallback(() => {
    setLastCompletedSummary(null);
  }, []);

  const dismissFcmBanner = useCallback(() => {
    setFcmNotificationBanner(null);
  }, []);

  return {
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
  };
};
