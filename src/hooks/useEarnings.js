// src/hooks/useEarnings.js
import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

const PAGE_SIZE = 20;

// Convierte un timestamp de Firestore, Date o número a objeto Date válido
export const parseTripDate = (rawDate) => {
  if (!rawDate) return new Date();
  if (typeof rawDate.toDate === 'function') {
    return rawDate.toDate();
  }
  if (typeof rawDate.seconds === 'number') {
    return new Date(rawDate.seconds * 1000);
  }
  const parsed = new Date(rawDate);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
};

/**
 * Calcula las métricas financieras de un conjunto de viajes (Sección 5):
 * número de viajes, total facturado, total de comisiones, propinas, ganancia neta y promedio por viaje.
 */
const computePeriodStats = (tripsList) => {
  const tripsCount = tripsList.length;
  if (tripsCount === 0) {
    return {
      tripsCount: 0,
      totalBilled: 0,
      totalCommissions: 0,
      totalTips: 0,
      netEarnings: 0,
      averagePerTrip: 0,
    };
  }

  let totalBilled = 0;
  let totalCommissions = 0;
  let totalTips = 0;
  let netEarnings = 0;

  for (const trip of tripsList) {
    totalBilled += Math.round(Number(trip.fare) || 0);
    totalCommissions += Math.round(Number(trip.commission) || 0);
    totalTips += Math.round(Number(trip.tip) || 0);
    netEarnings += Math.round(Number(trip.driverEarnings) || 0);
  }

  const averagePerTrip = Math.round(netEarnings / tripsCount);

  return {
    tripsCount,
    totalBilled,
    totalCommissions,
    totalTips,
    netEarnings,
    averagePerTrip,
  };
};

/**
 * Hook personalizado obligatorio useEarnings (Secciones 3, 5 y 6):
 * - Escucha en tiempo real (onSnapshot) los viajes del conductor en Firestore.
 * - Calcula con useMemo los resúmenes de Hoy, Semana y Mes, así como el saldo del conductor.
 * - Provee paginación de 20 viajes por carga para el Historial de carreras.
 */
export const useEarnings = (driverId) => {
  const [allTrips, setAllTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [visibleLimit, setVisibleLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    if (!driverId) {
      setAllTrips([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const tripsQuery = query(
      collection(db, 'trips'),
      where('driverId', '==', driverId)
    );

    const unsubscribe = onSnapshot(
      tripsQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const tripDate = parseTripDate(data.completedAt || data.createdAt);
          return {
            id: docSnap.id,
            ...data,
            tripDate,
          };
        });

        // Ordenar del viaje más reciente al más antiguo (Sección 6)
        docs.sort((a, b) => b.tripDate.getTime() - a.tripDate.getTime());

        setAllTrips(docs);
        setLoading(false);
      },
      () => {
        setError('No se pudo cargar el historial de viajes y ganancias.');
        setLoading(false);
      }
    );

    // Función de limpieza obligatoria en useEffect
    return () => {
      unsubscribe();
    };
  }, [driverId]);

  // Solo viajes finalizados ('completed' o 'paid') cuentan para ganancias
  const finishedTrips = useMemo(
    () => allTrips.filter((t) => t.status === 'paid' || t.status === 'completed'),
    [allTrips]
  );

  // Totales de Hoy, Semana y Mes memorizados con useMemo (Sección 5)
  const earningsByPeriod = useMemo(() => {
    const now = new Date();

    // Inicio de Hoy (00:00:00)
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Inicio de la Semana (últimos 7 días / lunes de la semana actual)
    const startOfWeek = new Date(startOfToday);
    const dayOfWeek = startOfWeek.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    startOfWeek.setDate(startOfWeek.getDate() - diffToMonday);

    // Inicio del Mes (día 1 del mes actual)
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayTrips = finishedTrips.filter((t) => t.tripDate >= startOfToday);
    const weekTrips = finishedTrips.filter((t) => t.tripDate >= startOfWeek);
    const monthTrips = finishedTrips.filter((t) => t.tripDate >= startOfMonth);

    return {
      today: computePeriodStats(todayTrips),
      week: computePeriodStats(weekTrips),
      month: computePeriodStats(monthTrips),
      all: computePeriodStats(finishedTrips),
    };
  }, [finishedTrips]);

  // Desglose del saldo del conductor (Sección 5: ganancias de pasarela menos comisiones en efectivo)
  const balanceBreakdown = useMemo(() => {
    let gatewayEarnings = 0;
    let cashCommissions = 0;
    let cashCollected = 0;

    for (const trip of finishedTrips) {
      const method = String(trip.paymentMethod || '').toLowerCase();
      if (method === 'cash' || method === 'efectivo') {
        cashCommissions += Math.round(Number(trip.commission) || 0);
        cashCollected += Math.round(Number(trip.fare) || 0) + Math.round(Number(trip.tip) || 0);
      } else {
        gatewayEarnings += Math.round(Number(trip.driverEarnings) || 0);
      }
    }

    return {
      gatewayEarnings,
      cashCommissions,
      cashCollected,
      calculatedBalance: gatewayEarnings - cashCommissions,
    };
  }, [finishedTrips]);

  // Paginación de 20 viajes por carga (Sección 6)
  const loadMoreTrips = useCallback(() => {
    setVisibleLimit((prev) => prev + PAGE_SIZE);
  }, []);

  const resetPagination = useCallback(() => {
    setVisibleLimit(PAGE_SIZE);
  }, []);

  return {
    allTrips,
    finishedTrips,
    earningsByPeriod,
    balanceBreakdown,
    loading,
    error,
    visibleLimit,
    pageSize: PAGE_SIZE,
    loadMoreTrips,
    resetPagination,
  };
};
