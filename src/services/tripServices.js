// src/services/tripServices.js
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import polyline from '@mapbox/polyline';
import { db } from '../config/firebase';
import { calculateFare } from '../utils/calculateFare';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// Decodificar polilínea enviada por Google Directions API
export const decodePolyline = (encoded) => {
  if (!encoded) return [];

  return polyline.decode(encoded).map(([latitude, longitude]) => ({
    latitude,
    longitude,
  }));
};

// Distancia Haversine en kilómetros entre dos coordenadas
export const calculateHaversineKm = (coord1, coord2) => {
  if (!coord1 || !coord2) return 2.5;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(coord2.latitude - coord1.latitude);
  const dLon = toRad(coord2.longitude - coord1.longitude);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.latitude)) *
      Math.cos(toRad(coord2.latitude)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(0.5, Number((R * c * 1.25).toFixed(2)));
};

// Genera puntos intermedios para trazar la ruta y simular el movimiento paso a paso
export const buildInterpolatedRoute = (start, end, steps = 15) => {
  if (!start || !end) return [];
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Ligera curvatura para simular calles reales cuando no hay respuesta de Directions API
    const curveOffset = Math.sin(t * Math.PI) * 0.0008;
    points.push({
      latitude: Number((start.latitude + (end.latitude - start.latitude) * t + curveOffset).toFixed(6)),
      longitude: Number((start.longitude + (end.longitude - start.longitude) * t - curveOffset).toFixed(6)),
    });
  }
  return points;
};

/**
 * Consulta Google Directions API para obtener distancia, duración y polilínea.
 * Si la API Key no tiene facturación activa o falla la red, usa cálculo Haversine y ruta interpolada.
 */
export const fetchDirectionsRoute = async (origin, destination) => {
  try {
    if (GOOGLE_MAPS_API_KEY) {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes?.length > 0) {
        const route = data.routes[0];
        const leg = route.legs?.[0];
        const distanceKm = leg?.distance?.value
          ? Number((leg.distance.value / 1000).toFixed(2))
          : calculateHaversineKm(origin, destination);
        const durationMin = leg?.duration?.value
          ? Math.max(2, Math.round(leg.duration.value / 60))
          : Math.max(4, Math.round(distanceKm * 2.8));
        const routeCoordinates = route.overview_polyline?.points
          ? decodePolyline(route.overview_polyline.points)
          : buildInterpolatedRoute(origin, destination, 18);

        return {
          distanceKm,
          durationMin,
          routeCoordinates,
        };
      }
    }
  } catch {
    // Continuar con ruta calculada localmente
  }

  const distanceKm = calculateHaversineKm(origin, destination);
  const durationMin = Math.max(4, Math.round(distanceKm * 2.8));
  const routeCoordinates = buildInterpolatedRoute(origin, destination, 16);

  return {
    distanceKm,
    durationMin,
    routeCoordinates,
  };
};

const SAMPLE_PASSENGERS = [
  { name: 'Valeria Gómez', rating: 4.9, paymentMethod: 'Efectivo', addressOrigin: 'Parque Lleras, El Poblado', addressDest: 'Centro Comercial Santafé' },
  { name: 'Andrés Restrepo', rating: 4.8, paymentMethod: 'Mercado Pago', addressOrigin: 'Estación Poblado Metro', addressDest: 'Unicentro Medellín, Laureles' },
  { name: 'Camila Mejía', rating: 5.0, paymentMethod: 'Tarjeta', addressOrigin: 'Milla de Oro, Cra. 43A', addressDest: 'Provenza, Calle 10' },
  { name: 'Santiago Ríos', rating: 4.7, paymentMethod: 'Efectivo', addressOrigin: 'Ciudad del Río', addressDest: 'Terminal del Sur' },
];

/**
 * Crea una solicitud de viaje simulada en Firestore ('trips') cercana a la ubicación del conductor
 */
export const createSimulatedTripRequest = async ({
  driverId,
  driverLocation,
  category = 'economy',
}) => {
  const baseLat = driverLocation?.latitude || 6.2442;
  const baseLng = driverLocation?.longitude || -75.5812;

  const sample = SAMPLE_PASSENGERS[Math.floor(Math.random() * SAMPLE_PASSENGERS.length)];

  // Punto de recogida a ~600m - 1.1km del conductor
  const origin = {
    address: sample.addressOrigin,
    latitude: Number((baseLat + 0.0055).toFixed(6)),
    longitude: Number((baseLng + 0.0042).toFixed(6)),
  };

  // Destino a ~2.5km - 4.5km del punto de recogida
  const destination = {
    address: sample.addressDest,
    latitude: Number((origin.latitude + 0.0185).toFixed(6)),
    longitude: Number((origin.longitude - 0.0125).toFixed(6)),
  };

  // Ruta desde el conductor hasta el pasajero y desde el pasajero hasta el destino
  const [pickupRouteData, tripRouteData] = await Promise.all([
    fetchDirectionsRoute({ latitude: baseLat, longitude: baseLng }, origin),
    fetchDirectionsRoute(origin, destination),
  ]);

  const fareBreakdown = calculateFare({
    distanceKm: tripRouteData.distanceKm,
    durationMin: tripRouteData.durationMin,
    category,
    tip: 0,
  });

  const tripDoc = {
    driverId,
    status: 'requested', // 'requested' -> 'accepted' -> 'arrived' -> 'in_progress' -> 'completed'
    passengerName: sample.name,
    passengerRating: sample.rating,
    paymentMethod: sample.paymentMethod,
    category,
    origin,
    destination,
    pickupDistanceKm: pickupRouteData.distanceKm,
    pickupDurationMin: pickupRouteData.durationMin,
    pickupCoordinates: pickupRouteData.routeCoordinates,
    distanceKm: tripRouteData.distanceKm,
    durationMin: tripRouteData.durationMin,
    routeCoordinates: tripRouteData.routeCoordinates,
    fare: fareBreakdown.fare,
    commission: fareBreakdown.commission,
    driverEarnings: fareBreakdown.driverEarnings,
    tip: 0,
    driverLocation: {
      latitude: baseLat,
      longitude: baseLng,
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'trips'), tripDoc);
  return { id: docRef.id, ...tripDoc };
};

/**
 * Aceptar solicitud de viaje en Firestore
 */
export const acceptTripInDB = async (tripId, driverLocation) => {
  const tripRef = doc(db, 'trips', tripId);
  await updateDoc(tripRef, {
    status: 'accepted',
    ...(driverLocation ? { driverLocation } : {}),
    acceptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Rechazar o expirar solicitud de viaje en Firestore
 */
export const rejectTripInDB = async (tripId, status = 'rejected') => {
  const tripRef = doc(db, 'trips', tripId);
  await updateDoc(tripRef, {
    status,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Cambiar el estado del viaje en curso ('arrived', 'in_progress', 'cancelled')
 */
export const updateTripStatusInDB = async (tripId, nextStatus, extraFields = {}) => {
  const tripRef = doc(db, 'trips', tripId);
  await updateDoc(tripRef, {
    status: nextStatus,
    ...extraFields,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Sincroniza en tiempo real la ubicación del conductor tanto en 'trips/{tripId}' como en 'drivers/{driverId}'
 */
export const syncTripDriverLocationInDB = async (tripId, driverId, coords) => {
  if (!coords?.latitude || !coords?.longitude) return;

  const updates = [];
  if (tripId) {
    updates.push(
      updateDoc(doc(db, 'trips', tripId), {
        driverLocation: {
          latitude: coords.latitude,
          longitude: coords.longitude,
        },
        updatedAt: serverTimestamp(),
      })
    );
  }
  if (driverId) {
    updates.push(
      updateDoc(doc(db, 'drivers', driverId), {
        location: {
          lat: coords.latitude,
          lng: coords.longitude,
        },
        updatedAt: serverTimestamp(),
      })
    );
  }
  await Promise.all(updates);
};

/**
 * Finaliza el viaje, guarda el desglose de tarifa + propina y suma la ganancia neta al saldo del conductor
 */
export const completeTripInDB = async ({
  tripId,
  driverId,
  distanceKm,
  durationMin,
  category = 'economy',
  tip = 0,
}) => {
  const breakdown = calculateFare({
    distanceKm,
    durationMin,
    category,
    tip,
  });

  const cleanTip = Math.max(0, Math.round(Number(tip) || 0));

  await Promise.all([
    updateDoc(doc(db, 'trips', tripId), {
      status: 'completed',
      fare: breakdown.fare,
      commission: breakdown.commission,
      driverEarnings: breakdown.driverEarnings,
      tip: cleanTip,
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    updateDoc(doc(db, 'drivers', driverId), {
      balance: increment(breakdown.driverEarnings),
      updatedAt: serverTimestamp(),
    }),
  ]);

  return breakdown;
};
