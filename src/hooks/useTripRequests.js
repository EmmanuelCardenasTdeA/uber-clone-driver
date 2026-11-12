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
  confirmTripPaymentInDB,
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
      return Promise.resolve(remoteMessage);
    });
  }
} catch {
  // Ignorar en entorno Expo Go
}

/**
 * Hook personalizado obligatorio useTripRequests (Sección 3):
 * Controla los 7 estados del viaje:
 * 1. requested -> 2. accepted -> 3. driver_arriving -> 4. in_progress -> 5. completed -> 6. paid (o 7. cancelled)
 */
export const useTripRequests = ({
  driverId,
  isAvailable,
  driverLocation,
  onSyncDriverLocation,
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

  // 2. Suscripción en tiempo real a Firestore (onSnapshot) para solicitudes y estados del viaje
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

        // Prioridad 1: Viaje en curso o pendiente de cobro ('accepted', 'driver_arriving', 'in_progress', 'completed')
        const ongoing = docs.find((t) =>
          ['accepted', 'driver_arriving', 'in_progress', 'completed'].includes(t.status)
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
          // Si llega a cero, la solicitud se rechaza automáticamente ('rejected' - Sección 3)
          rejectTripInDB(incomingRequest.id).catch(() => {});
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
      if (created?.driverLocation && onSyncDriverLocation) {
        onSyncDriverLocation(created.driverLocation);
      }
      setFcmNotificationBanner(
        `Notificación FCM: Nueva solicitud de ${created.passengerName} (${created.origin.address})`
      );
    } catch {
      setTripError('No se pudo generar la solicitud simulada.');
    } finally {
      setActionLoading(false);
    }
  }, [driverId, isAvailable, driverLocation, onSyncDriverLocation, vehicleCategory]);

  // Estado 2 ('accepted'): El conductor acepta la solicitud
  const acceptTrip = useCallback(async () => {
    if (!incomingRequest?.id) return;
    setTripError(null);
    setActionLoading(true);
    try {
      const startLoc = incomingRequest.driverLocation || driverLocation;
      await acceptTripInDB(incomingRequest.id, startLoc);
      if (startLoc && onSyncDriverLocation) {
        onSyncDriverLocation(startLoc);
      }
      setFcmNotificationBanner(null);
    } catch {
      setTripError('No se pudo aceptar el viaje.');
    } finally {
      setActionLoading(false);
    }
  }, [incomingRequest, driverLocation, onSyncDriverLocation]);

  // Rechazar solicitud entrante ('rejected')
  const rejectTrip = useCallback(async () => {
    if (!incomingRequest?.id) return;
    setTripError(null);
    setActionLoading(true);
    try {
      await rejectTripInDB(incomingRequest.id);
      setFcmNotificationBanner(null);
    } catch {
      setTripError('No se pudo rechazar la solicitud.');
    } finally {
      setActionLoading(false);
    }
  }, [incomingRequest?.id]);

  // Estado 3 ('driver_arriving'): El conductor va en camino / llega al punto de recogida
  const markDriverArriving = useCallback(async () => {
    if (!activeTrip?.id) return;
    setTripError(null);
    setActionLoading(true);
    try {
      await updateTripStatusInDB(activeTrip.id, 'driver_arriving', {
        arrivingAt: serverTimestamp(),
      });
    } catch {
      setTripError('No se pudo actualizar el estado a En camino al punto de recogida.');
    } finally {
      setActionLoading(false);
    }
  }, [activeTrip?.id]);

  // Estado 4 ('in_progress'): "Pasajero a bordo" -> la ruta cambia hacia el destino
  const startTripWithPassenger = useCallback(async () => {
    if (!activeTrip?.id) return;
    setTripError(null);
    setActionLoading(true);
    try {
      const pickupPoint = activeTrip.origin
        ? {
            lat: activeTrip.origin.lat ?? activeTrip.origin.latitude,
            lng: activeTrip.origin.lng ?? activeTrip.origin.longitude,
            latitude: activeTrip.origin.latitude ?? activeTrip.origin.lat,
            longitude: activeTrip.origin.longitude ?? activeTrip.origin.lng,
          }
        : null;
      await updateTripStatusInDB(activeTrip.id, 'in_progress', {
        ...(pickupPoint ? { driverLocation: pickupPoint } : {}),
        startedAt: serverTimestamp(),
      });
      if (pickupPoint && onSyncDriverLocation) {
        onSyncDriverLocation(pickupPoint);
      }
    } catch {
      setTripError('No se pudo iniciar el viaje con el pasajero a bordo.');
    } finally {
      setActionLoading(false);
    }
  }, [activeTrip?.id, activeTrip?.origin, onSyncDriverLocation]);

  // Estado 5 ('completed'): Finaliza el viaje y calcula tarifa, comisión y ganancia neta
  const finishTrip = useCallback(
    async (tipAmount = 0) => {
      if (!activeTrip?.id || !driverId) return null;
      setTripError(null);
      setActionLoading(true);
      try {
        const destPoint = activeTrip.destination
          ? {
              latitude: activeTrip.destination.latitude ?? activeTrip.destination.lat,
              longitude: activeTrip.destination.longitude ?? activeTrip.destination.lng,
            }
          : null;

        const breakdown = await completeTripInDB({
          tripId: activeTrip.id,
          distanceKm: activeTrip.distanceKm,
          durationMin: activeTrip.durationMin,
          category: activeTrip.category || vehicleCategory || 'economy',
          tip: tipAmount,
        });

        if (destPoint && onSyncDriverLocation) {
          onSyncDriverLocation(destPoint);
        }

        return breakdown;
      } catch {
        setTripError('No se pudo finalizar el viaje.');
        return null;
      } finally {
        setActionLoading(false);
      }
    },
    [activeTrip, driverId, vehicleCategory, onSyncDriverLocation]
  );

  // Estado 6 ('paid'): Confirma el pago (Efectivo o Pasarela) y actualiza el saldo del conductor
  const confirmTripPayment = useCallback(
    async ({ paymentStatus = 'approved', paymentId = null } = {}) => {
      if (!activeTrip?.id || !driverId) return false;
      setTripError(null);
      setActionLoading(true);
      try {
        await confirmTripPaymentInDB({
          tripId: activeTrip.id,
          driverId,
          paymentMethod: activeTrip.paymentMethod,
          paymentStatus,
          paymentId,
          commission: activeTrip.commission,
          driverEarnings: activeTrip.driverEarnings,
        });

        setLastCompletedSummary({
          passengerName: activeTrip.passengerName,
          paymentMethod: activeTrip.paymentMethod,
          fare: activeTrip.fare,
          commission: activeTrip.commission,
          driverEarnings: activeTrip.driverEarnings,
          tip: activeTrip.tip || 0,
        });
        return true;
      } catch {
        setTripError('No se pudo registrar la confirmación del pago.');
        return false;
      } finally {
        setActionLoading(false);
      }
    },
    [activeTrip, driverId]
  );

  // Estado 7 ('cancelled'): Solo permitido ANTES de 'in_progress' (Sección 3)
  const cancelActiveTrip = useCallback(
    async (reason = 'Cancelado por el conductor antes de abordar') => {
      if (!activeTrip?.id) return;
      if (['in_progress', 'completed', 'paid'].includes(activeTrip.status)) {
        setTripError('No se puede cancelar un viaje cuando el pasajero ya está a bordo.');
        return;
      }

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
    [activeTrip?.id, activeTrip?.status]
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
    markDriverArriving,
    startTripWithPassenger,
    finishTrip,
    confirmTripPayment,
    cancelActiveTrip,
    dismissCompletedSummary,
    dismissFcmBanner,
  };
};
