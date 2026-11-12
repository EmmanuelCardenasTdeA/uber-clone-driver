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

// Formatea el código de método de pago ('mercadopago' | 'stripe' | 'cash') para mostrar en la UI
export const formatPaymentMethodLabel = (method) => {
  switch (String(method || '').toLowerCase()) {
    case 'mercadopago':
      return 'Mercado Pago';
    case 'stripe':
      return 'Stripe';
    case 'cash':
      return 'Efectivo';
    default:
      return method || 'Efectivo';
  }
};

// Decodificar polilínea enviada por Google Directions API u OSRM
export const decodePolyline = (encoded) => {
  if (!encoded) return [];

  return polyline.decode(encoded).map(([latitude, longitude]) => ({
    latitude,
    longitude,
  }));
};

// Distancia Haversine en kilómetros entre dos coordenadas
export const calculateHaversineKm = (coord1, coord2) => {
  const lat1 = coord1?.latitude ?? coord1?.lat;
  const lon1 = coord1?.longitude ?? coord1?.lng;
  const lat2 = coord2?.latitude ?? coord2?.lat;
  const lon2 = coord2?.longitude ?? coord2?.lng;
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 2.5;

  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(0.4, Number((R * c * 1.25).toFixed(2)));
};

// Interpola suavemente una lista de waypoints
export const interpolateWaypoints = (waypoints, pointsPerSegment = 6) => {
  if (!waypoints || waypoints.length < 2) return waypoints || [];
  const result = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i];
    const end = waypoints[i + 1];
    const sLat = start.latitude ?? start.lat;
    const sLng = start.longitude ?? start.lng;
    const eLat = end.latitude ?? end.lat;
    const eLng = end.longitude ?? end.lng;
    for (let s = 0; s < pointsPerSegment; s++) {
      const t = s / pointsPerSegment;
      result.push({
        latitude: Number((sLat + (eLat - sLat) * t).toFixed(6)),
        longitude: Number((sLng + (eLng - sLng) * t).toFixed(6)),
      });
    }
  }
  const last = waypoints[waypoints.length - 1];
  result.push({
    latitude: last.latitude ?? last.lat,
    longitude: last.longitude ?? last.lng,
  });
  return result;
};

export const buildInterpolatedRoute = (start, end, steps = 15) => {
  if (!start || !end) return [];
  return interpolateWaypoints([start, end], steps);
};

/**
 * Convierte una coordenada { latitude, longitude } en su dirección real en el mapa
 * usando Nominatim (OpenStreetMap, recomendada en Sección 7 del documento).
 */
export const reverseGeocodeCoordinate = async (coord, fallbackStreetName = '') => {
  const lat = coord?.latitude ?? coord?.lat;
  const lng = coord?.longitude ?? coord?.lng;
  if (lat == null || lng == null) return fallbackStreetName || 'Punto en el mapa';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'UberCloneDriverApp/1.0',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const addr = data?.address || {};
      const road =
        addr.road ||
        addr.pedestrian ||
        addr.avenue ||
        addr.street ||
        data?.name ||
        fallbackStreetName;
      const houseNumber = addr.house_number ? ` #${addr.house_number}` : '';
      const area =
        addr.suburb ||
        addr.neighbourhood ||
        addr.quarter ||
        addr.city_district ||
        addr.town ||
        addr.city ||
        '';

      if (road && area) {
        return `${road}${houseNumber}, ${area}`;
      }
      if (road) {
        return `${road}${houseNumber}`;
      }
      if (data?.display_name) {
        return data.display_name.split(',').slice(0, 2).join(',').trim();
      }
    }
  } catch {
    // Usar nombre de vía devuelto por el ruteador si Nominatim tarda o no hay red
  }

  if (fallbackStreetName && fallbackStreetName.trim()) {
    return fallbackStreetName.trim();
  }
  return `Vía principal (${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)})`;
};

/**
 * Obtiene la ruta vial real entre dos puntos a partir de la posición actual del mapa:
 * 1. Intenta Google Directions API.
 * 2. Si no está disponible, usa OSRM Driving API que ajusta (snaps) las coordenadas
 *    exactamente sobre las calles reales del mapa y devuelve la polilínea vial exacta.
 */
export const fetchDirectionsRoute = async (origin, destination) => {
  const oLat = origin.latitude ?? origin.lat;
  const oLng = origin.longitude ?? origin.lng;
  const dLat = destination.latitude ?? destination.lat;
  const dLng = destination.longitude ?? destination.lng;

  // 1. Intentar Google Directions API
  try {
    if (GOOGLE_MAPS_API_KEY) {
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${oLat},${oLng}&destination=${dLat},${dLng}&mode=driving&language=es&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes?.length > 0) {
        const route = data.routes[0];
        const leg = route.legs?.[0];
        const routeCoordinates = route.overview_polyline?.points
          ? decodePolyline(route.overview_polyline.points)
          : interpolateWaypoints([origin, destination], 12);

        const snappedStart = routeCoordinates[0] || { latitude: oLat, longitude: oLng };
        const snappedEnd =
          routeCoordinates[routeCoordinates.length - 1] || { latitude: dLat, longitude: dLng };

        const distanceKm = leg?.distance?.value
          ? Math.max(0.4, Number((leg.distance.value / 1000).toFixed(2)))
          : calculateHaversineKm(snappedStart, snappedEnd);
        const durationMin = leg?.duration?.value
          ? Math.max(2, Math.round(leg.duration.value / 60))
          : Math.max(3, Math.round(distanceKm * 2.8));

        return {
          distanceKm,
          durationMin,
          routeCoordinates,
          snappedOrigin: snappedStart,
          snappedDestination: snappedEnd,
          startAddressHint: leg?.start_address
            ? leg.start_address.split(',').slice(0, 2).join(',').trim()
            : '',
          endAddressHint: leg?.end_address
            ? leg.end_address.split(',').slice(0, 2).join(',').trim()
            : '',
        };
      }
    }
  } catch {
    // Continuar con OSRM
  }

  // 2. Consultar OSRM (ajusta los puntos a la calle más cercana y traza la ruta real sobre las vías)
  try {
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${oLng},${oLat};${dLng},${dLat}?overview=full&geometries=polyline`;
    const response = await fetch(osrmUrl);
    const data = await response.json();

    if (data.code === 'Ok' && data.routes?.length > 0) {
      const route = data.routes[0];
      const decoded = decodePolyline(route.geometry);
      if (decoded.length > 1) {
        const snappedStart = decoded[0];
        const snappedEnd = decoded[decoded.length - 1];
        const distanceKm = route.distance
          ? Math.max(0.4, Number((route.distance / 1000).toFixed(2)))
          : calculateHaversineKm(snappedStart, snappedEnd);
        const durationMin = route.duration
          ? Math.max(2, Math.round(route.duration / 60))
          : Math.max(3, Math.round(distanceKm * 2.8));

        const startStreet = data.waypoints?.[0]?.name || '';
        const endStreet = data.waypoints?.[1]?.name || '';

        return {
          distanceKm,
          durationMin,
          routeCoordinates: decoded,
          snappedOrigin: snappedStart,
          snappedDestination: snappedEnd,
          startAddressHint: startStreet,
          endAddressHint: endStreet,
        };
      }
    }
  } catch {
    // Respaldo interpolado si no hay conexión a internet
  }

  // 3. Respaldo directo conectado exactamente de punto a punto
  const startCoord = { latitude: Number(oLat.toFixed(6)), longitude: Number(oLng.toFixed(6)) };
  const endCoord = { latitude: Number(dLat.toFixed(6)), longitude: Number(dLng.toFixed(6)) };
  const midPoint = {
    latitude: Number(((oLat + dLat) / 2 + 0.0012).toFixed(6)),
    longitude: Number(((oLng + dLng) / 2 - 0.0009).toFixed(6)),
  };
  const routeCoordinates = interpolateWaypoints([startCoord, midPoint, endCoord], 7);
  const distanceKm = calculateHaversineKm(startCoord, endCoord);
  const durationMin = Math.max(3, Math.round(distanceKm * 2.8));

  return {
    distanceKm,
    durationMin,
    routeCoordinates,
    snappedOrigin: startCoord,
    snappedDestination: endCoord,
    startAddressHint: '',
    endAddressHint: '',
  };
};

// Perfiles de pasajeros y vectores de desplazamiento alrededor de la ubicación real del conductor
const PASSENGER_PROFILES = [
  {
    passengerId: 'passenger_valeria_01',
    passengerName: 'Valeria Gómez',
    rating: 5,
    paymentMethod: 'cash',
    // Recogida a ~650m al noreste del conductor; destino a ~2.4km al sur
    pickupOffset: { dLat: 0.0048, dLng: 0.0035 },
    destOffset: { dLat: -0.0165, dLng: -0.0085 },
  },
  {
    passengerId: 'passenger_andres_02',
    passengerName: 'Andrés Restrepo',
    rating: 5,
    paymentMethod: 'mercadopago',
    // Recogida a ~550m al noroeste del conductor; destino a ~2.8km al noreste
    pickupOffset: { dLat: 0.0038, dLng: -0.0042 },
    destOffset: { dLat: 0.0195, dLng: 0.0110 },
  },
  {
    passengerId: 'passenger_camila_03',
    passengerName: 'Camila Mejía',
    rating: 5,
    paymentMethod: 'stripe',
    // Recogida a ~700m al sur del conductor; destino a ~2.2km al noroeste
    pickupOffset: { dLat: -0.0052, dLng: 0.0028 },
    destOffset: { dLat: 0.0155, dLng: -0.0140 },
  },
  {
    passengerId: 'passenger_santiago_04',
    passengerName: 'Santiago Ríos',
    rating: 4,
    paymentMethod: 'cash',
    // Recogida a ~600m al oeste del conductor; destino a ~2.6km al sureste
    pickupOffset: { dLat: 0.0022, dLng: -0.0055 },
    destOffset: { dLat: -0.0175, dLng: 0.0125 },
  },
  {
    passengerId: 'passenger_laura_05',
    passengerName: 'Laura Montoya',
    rating: 5,
    paymentMethod: 'mercadopago',
    // Recogida a ~500m al sureste del conductor; destino a ~3.0km al norte
    pickupOffset: { dLat: -0.0036, dLng: 0.0044 },
    destOffset: { dLat: 0.0235, dLng: -0.0065 },
  },
];

let lastScenarioIndex = -1;

/**
 * Crea una solicitud de viaje 100% coherente con la posición real actual del mapa del conductor:
 * 1. Parte exactamente de la coordenada actual del conductor en el mapa (driverLocation).
 * 2. Calcula la ruta vial desde el conductor hasta el punto de recogida cercano y ajusta (snaps)
 *    el marcador de recogida exactamente sobre la calle donde termina la polilínea azul.
 * 3. Calcula la ruta vial desde ese punto de recogida hasta el destino y ajusta (snaps)
 *    el marcador de destino exactamente sobre la calle donde termina la polilínea verde.
 * 4. Obtiene los nombres reales de las calles/barrios de esos puntos exactos con Nominatim / Directions.
 */
export const createSimulatedTripRequest = async ({
  driverId,
  driverLocation,
  category = 'economy',
}) => {
  lastScenarioIndex = (lastScenarioIndex + 1) % PASSENGER_PROFILES.length;
  const profile = PASSENGER_PROFILES[lastScenarioIndex];

  const currentDriverCoord = {
    latitude: Number((driverLocation?.latitude ?? 6.2442).toFixed(6)),
    longitude: Number((driverLocation?.longitude ?? -75.5812).toFixed(6)),
  };

  // Coordenadas objetivo iniciales relativas a la posición actual del conductor en el mapa
  const targetPickup = {
    latitude: Number((currentDriverCoord.latitude + profile.pickupOffset.dLat).toFixed(6)),
    longitude: Number((currentDriverCoord.longitude + profile.pickupOffset.dLng).toFixed(6)),
  };

  // 1. Obtener ruta vial desde la ubicación exacta del conductor hasta el punto de recogida
  const pickupRouteData = await fetchDirectionsRoute(currentDriverCoord, targetPickup);

  // El punto de recogida exacto es donde termina la ruta de recogida (sobre la calle real)
  const snappedPickupCoord = pickupRouteData.snappedDestination || targetPickup;

  // Coordenada objetivo de destino relativa al punto de recogida real
  const targetDestination = {
    latitude: Number((snappedPickupCoord.latitude + profile.destOffset.dLat).toFixed(6)),
    longitude: Number((snappedPickupCoord.longitude + profile.destOffset.dLng).toFixed(6)),
  };

  // 2. Obtener ruta vial desde el punto exacto de recogida hasta el destino
  const tripRouteData = await fetchDirectionsRoute(snappedPickupCoord, targetDestination);

  // El punto de destino exacto es donde termina la polilínea del viaje (sobre la calle real)
  const snappedDestCoord = tripRouteData.snappedDestination || targetDestination;

  // Asegurar que la polilínea del viaje comience exactamente en el marcador de recogida
  const exactOriginCoord = tripRouteData.snappedOrigin || snappedPickupCoord;

  // 3. Obtener las direcciones reales de las calles correspondientes a esos marcadores en el mapa
  const [originAddress, destinationAddress] = await Promise.all([
    reverseGeocodeCoordinate(
      exactOriginCoord,
      pickupRouteData.endAddressHint || tripRouteData.startAddressHint
    ),
    reverseGeocodeCoordinate(snappedDestCoord, tripRouteData.endAddressHint),
  ]);

  const origin = {
    address: originAddress,
    lat: exactOriginCoord.latitude,
    lng: exactOriginCoord.longitude,
    latitude: exactOriginCoord.latitude,
    longitude: exactOriginCoord.longitude,
  };

  const destination = {
    address: destinationAddress,
    lat: snappedDestCoord.latitude,
    lng: snappedDestCoord.longitude,
    latitude: snappedDestCoord.latitude,
    longitude: snappedDestCoord.longitude,
  };

  // Garantizar que el primer punto de pickupCoordinates sea la posición del conductor y el último sea origin
  const pickupCoordinates =
    pickupRouteData.routeCoordinates?.length > 1
      ? [
          currentDriverCoord,
          ...pickupRouteData.routeCoordinates.slice(1, -1),
          { latitude: origin.latitude, longitude: origin.longitude },
        ]
      : [currentDriverCoord, { latitude: origin.latitude, longitude: origin.longitude }];

  // Garantizar que el primer punto de routeCoordinates sea origin y el último sea destination
  const routeCoordinates =
    tripRouteData.routeCoordinates?.length > 1
      ? [
          { latitude: origin.latitude, longitude: origin.longitude },
          ...tripRouteData.routeCoordinates.slice(1, -1),
          { latitude: destination.latitude, longitude: destination.longitude },
        ]
      : [
          { latitude: origin.latitude, longitude: origin.longitude },
          { latitude: destination.latitude, longitude: destination.longitude },
        ];

  const fareBreakdown = calculateFare({
    distanceKm: tripRouteData.distanceKm,
    durationMin: tripRouteData.durationMin,
    category,
    tip: 0,
  });

  const tripDoc = {
    driverId,
    passengerId: profile.passengerId,
    passengerName: profile.passengerName,
    rating: profile.rating,
    passengerRating: profile.rating,
    paymentMethod: profile.paymentMethod, // 'mercadopago' | 'stripe' | 'cash'
    paymentStatus: 'pending',
    paymentId: null,
    category,
    origin,
    destination,
    pickupDistanceKm: pickupRouteData.distanceKm,
    pickupDurationMin: pickupRouteData.durationMin,
    pickupCoordinates,
    distanceKm: tripRouteData.distanceKm,
    durationMin: tripRouteData.durationMin,
    routeCoordinates,
    fare: fareBreakdown.fare,
    commission: fareBreakdown.commission,
    driverEarnings: fareBreakdown.driverEarnings,
    commissionRate: fareBreakdown.commissionRate,
    tip: 0,
    status: 'requested',
    driverLocation: {
      lat: currentDriverCoord.latitude,
      lng: currentDriverCoord.longitude,
      latitude: currentDriverCoord.latitude,
      longitude: currentDriverCoord.longitude,
    },
    createdAt: serverTimestamp(),
    completedAt: null,
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'trips'), tripDoc);
  return { id: docRef.id, ...tripDoc };
};

/**
 * Aceptar solicitud de viaje en Firestore (Estado 2: 'accepted')
 */
export const acceptTripInDB = async (tripId, driverLocation) => {
  const tripRef = doc(db, 'trips', tripId);
  await updateDoc(tripRef, {
    status: 'accepted',
    ...(driverLocation
      ? {
          driverLocation: {
            lat: driverLocation.latitude,
            lng: driverLocation.longitude,
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
          },
        }
      : {}),
    acceptedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Rechazar o expirar solicitud de viaje en Firestore ('rejected')
 */
export const rejectTripInDB = async (tripId) => {
  const tripRef = doc(db, 'trips', tripId);
  await updateDoc(tripRef, {
    status: 'rejected',
    updatedAt: serverTimestamp(),
  });
};

/**
 * Cambiar el estado del viaje en curso ('driver_arriving', 'in_progress', 'cancelled')
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
          lat: coords.latitude,
          lng: coords.longitude,
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
 * Estado 5 ('completed'): Finaliza el recorrido físico del viaje y calcula tarifa, comisión y ganancia neta
 * con la misma función pura calculateFare usada en la estimación.
 */
export const completeTripInDB = async ({
  tripId,
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

  await updateDoc(doc(db, 'trips', tripId), {
    status: 'completed',
    fare: breakdown.fare,
    commission: breakdown.commission,
    driverEarnings: breakdown.driverEarnings,
    commissionRate: breakdown.commissionRate,
    tip: cleanTip,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return breakdown;
};

/**
 * Estado 6 ('paid'): Registra el pago del viaje (Efectivo o Pasarela Mercado Pago / Stripe)
 * y actualiza el saldo del conductor según la regla de la Sección 4:
 * - En efectivo ('cash'): la comisión se descuenta del saldo del conductor (puede quedar en negativo).
 * - En pasarela ('mercadopago' | 'stripe'): se abona la ganancia neta (driverEarnings) al saldo.
 */
export const confirmTripPaymentInDB = async ({
  tripId,
  driverId,
  paymentMethod,
  paymentStatus = 'approved',
  paymentId = null,
  commission = 0,
  driverEarnings = 0,
}) => {
  const isCash = String(paymentMethod || '').toLowerCase() === 'cash';
  const balanceDelta = isCash ? -Math.abs(Number(commission) || 0) : Number(driverEarnings) || 0;

  await Promise.all([
    updateDoc(doc(db, 'trips', tripId), {
      status: 'paid',
      paymentStatus: isCash ? 'cash' : paymentStatus,
      paymentId: paymentId || (isCash ? `cash_${Date.now()}` : `mp_${Date.now()}`),
      paidAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
    updateDoc(doc(db, 'drivers', driverId), {
      balance: increment(balanceDelta),
      updatedAt: serverTimestamp(),
    }),
  ]);
};
