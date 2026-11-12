// src/screens/driver/EarningsScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { useRegistration } from '../../context/RegistrationContext';
import { useEarnings } from '../../hooks/useEarnings';
import { formatPaymentMethodLabel } from '../../services/tripServices';

const PERIODS = [
  { key: 'today', label: 'Hoy', icon: 'today-outline' },
  { key: 'week', label: 'Semana', icon: 'calendar-outline' },
  { key: 'month', label: 'Mes', icon: 'stats-chart-outline' },
];

export default function EarningsScreen() {
  const { driverId, driverProfile } = useRegistration();
  const insets = useSafeAreaInsets();
  const [selectedPeriod, setSelectedPeriod] = useState('today');
  const [resettingBalance, setResettingBalance] = useState(false);

  const {
    finishedTrips,
    earningsByPeriod,
    balanceBreakdown,
    loading,
    error,
  } = useEarnings(driverId);

  const activeStats = earningsByPeriod[selectedPeriod] || earningsByPeriod.today;
  const currentBalance =
    driverProfile?.balance !== undefined
      ? Number(driverProfile.balance)
      : balanceBreakdown.calculatedBalance;

  const handleResetBalance = async () => {
    if (!driverId || resettingBalance) return;
    try {
      setResettingBalance(true);
      await updateDoc(doc(db, 'drivers', driverId), {
        balance: 0,
        updatedAt: serverTimestamp(),
      });
    } finally {
      setResettingBalance(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.container,
        { paddingBottom: Math.max(insets.bottom + 24, 36) },
      ]}
      showsVerticalScrollIndicator={false}
    >
      {/* Selector de periodo: Hoy / Semana / Mes */}
      <View style={styles.periodSelector}>
        {PERIODS.map((period) => {
          const active = selectedPeriod === period.key;
          return (
            <TouchableOpacity
              key={period.key}
              style={[styles.periodBtn, active && styles.periodBtnActive]}
              onPress={() => setSelectedPeriod(period.key)}
            >
              <Ionicons
                name={period.icon}
                size={16}
                color={active ? '#FFFFFF' : '#4B5563'}
              />
              <Text style={[styles.periodBtnText, active && styles.periodBtnTextActive]}>
                {period.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Tarjeta principal de Ganancia Neta del periodo */}
      <View style={styles.heroCard}>
        <View style={styles.heroHeaderRow}>
          <Ionicons name="wallet-outline" size={22} color="#86EFAC" />
          <Text style={styles.heroLabel}>
            Ganancia neta ({PERIODS.find((p) => p.key === selectedPeriod)?.label})
          </Text>
        </View>
        <Text style={styles.heroAmount}>
          ${activeStats.netEarnings.toLocaleString('es-CO')} COP
        </Text>
        <View style={styles.heroSubRow}>
          <View style={styles.heroPill}>
            <Ionicons name="car-sport-outline" size={14} color="#FFFFFF" />
            <Text style={styles.heroPillText}>
              {activeStats.tripsCount} {activeStats.tripsCount === 1 ? 'viaje' : 'viajes'}
            </Text>
          </View>
          <View style={styles.heroPill}>
            <Ionicons name="trending-up-outline" size={14} color="#FFFFFF" />
            <Text style={styles.heroPillText}>
              Promedio: ${activeStats.averagePerTrip.toLocaleString('es-CO')} / viaje
            </Text>
          </View>
        </View>
      </View>

      {/* Tarjeta de Saldo del Conductor (Sección 5: pasarela menos comisiones en efectivo) */}
      <View style={styles.balanceCard}>
        <View style={styles.balanceTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.balanceTitle}>Saldo en cuenta del conductor</Text>
            <Text style={styles.balanceSubtitle}>
              Ganancias por pasarela menos comisiones de viajes en efectivo
            </Text>
          </View>
          <Text
            style={[
              styles.balanceTotalValue,
              { color: currentBalance < 0 ? '#DC2626' : '#16A34A' },
            ]}
          >
            ${currentBalance.toLocaleString('es-CO')} COP
          </Text>
        </View>

        <View style={styles.balanceDivider} />

        <View style={styles.balanceDetailRow}>
          <View style={styles.balanceDetailItem}>
            <Ionicons name="card-outline" size={16} color="#16A34A" />
            <Text style={styles.balanceDetailLabel}>Abonos pasarela (80%):</Text>
          </View>
          <Text style={[styles.balanceDetailAmount, { color: '#16A34A' }]}>
            +${balanceBreakdown.gatewayEarnings.toLocaleString('es-CO')} COP
          </Text>
        </View>

        <View style={styles.balanceDetailRow}>
          <View style={styles.balanceDetailItem}>
            <Ionicons name="cash-outline" size={16} color="#DC2626" />
            <Text style={styles.balanceDetailLabel}>Comisiones efectivo (20%):</Text>
          </View>
          <Text style={[styles.balanceDetailAmount, { color: '#DC2626' }]}>
            -${balanceBreakdown.cashCommissions.toLocaleString('es-CO')} COP
          </Text>
        </View>

        <View style={styles.balanceDetailRow}>
          <View style={styles.balanceDetailItem}>
            <Ionicons name="hand-left-outline" size={16} color="#4B5563" />
            <Text style={styles.balanceDetailLabel}>Efectivo recibido en mano:</Text>
          </View>
          <Text style={styles.balanceDetailAmount}>
            ${balanceBreakdown.cashCollected.toLocaleString('es-CO')} COP
          </Text>
        </View>

        <TouchableOpacity
          style={styles.resetBalanceBtn}
          onPress={handleResetBalance}
          disabled={resettingBalance}
        >
          <Ionicons name="refresh-outline" size={15} color="#4B5563" />
          <Text style={styles.resetBalanceText}>
            {resettingBalance ? 'Reiniciando saldo...' : 'Reiniciar saldo a $0 (Liquidación)'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Grilla con las 6 métricas obligatorias de la Sección 5 */}
      <Text style={styles.sectionTitle}>Desglose del periodo</Text>

      {loading ? (
        <ActivityIndicator size="large" color="#111827" style={{ marginVertical: 24 }} />
      ) : (
        <View style={styles.metricsGrid}>
          <View style={styles.metricBox}>
            <Ionicons name="navigate-outline" size={20} color="#2563EB" />
            <Text style={styles.metricLabel}>Número de viajes</Text>
            <Text style={styles.metricValue}>{activeStats.tripsCount}</Text>
          </View>

          <View style={styles.metricBox}>
            <Ionicons name="receipt-outline" size={20} color="#111827" />
            <Text style={styles.metricLabel}>Total facturado</Text>
            <Text style={styles.metricValue}>
              ${activeStats.totalBilled.toLocaleString('es-CO')}
            </Text>
          </View>

          <View style={styles.metricBox}>
            <Ionicons name="pie-chart-outline" size={20} color="#DC2626" />
            <Text style={styles.metricLabel}>Comisiones (20%)</Text>
            <Text style={[styles.metricValue, { color: '#DC2626' }]}>
              -${activeStats.totalCommissions.toLocaleString('es-CO')}
            </Text>
          </View>

          <View style={styles.metricBox}>
            <Ionicons name="heart-outline" size={20} color="#D97706" />
            <Text style={styles.metricLabel}>Propinas (100%)</Text>
            <Text style={[styles.metricValue, { color: '#D97706' }]}>
              +${activeStats.totalTips.toLocaleString('es-CO')}
            </Text>
          </View>

          <View style={styles.metricBox}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#16A34A" />
            <Text style={styles.metricLabel}>Ganancia neta</Text>
            <Text style={[styles.metricValue, { color: '#16A34A' }]}>
              ${activeStats.netEarnings.toLocaleString('es-CO')}
            </Text>
          </View>

          <View style={styles.metricBox}>
            <Ionicons name="analytics-outline" size={20} color="#7C3AED" />
            <Text style={styles.metricLabel}>Promedio / viaje</Text>
            <Text style={styles.metricValue}>
              ${activeStats.averagePerTrip.toLocaleString('es-CO')}
            </Text>
          </View>
        </View>
      )}

      {/* Últimos viajes liquidados */}
      <Text style={styles.sectionTitle}>Últimas carreras contabilizadas</Text>
      {finishedTrips.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="car-outline" size={36} color="#9CA3AF" />
          <Text style={styles.emptyText}>
            Aún no tienes viajes finalizados para calcular ganancias.
          </Text>
        </View>
      ) : (
        finishedTrips.slice(0, 5).map((trip) => (
          <View key={trip.id} style={styles.recentItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.recentOriginDest} numberOfLines={1}>
                {trip.origin?.address} → {trip.destination?.address}
              </Text>
              <Text style={styles.recentMeta}>
                {trip.tripDate.toLocaleDateString('es-CO')}{' '}
                {trip.tripDate.toLocaleTimeString('es-CO', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}{' '}
                • {formatPaymentMethodLabel(trip.paymentMethod)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.recentNet}>
                +${(trip.driverEarnings || 0).toLocaleString('es-CO')}
              </Text>
              <Text style={styles.recentGross}>
                Tarifa: ${(trip.fare || 0).toLocaleString('es-CO')}
              </Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F4F6' },
  container: { padding: 16, gap: 14 },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  periodBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 9,
  },
  periodBtnActive: {
    backgroundColor: '#111827',
  },
  periodBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4B5563',
  },
  periodBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: { color: '#DC2626', fontSize: 12, flex: 1 },
  heroCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 18,
    gap: 8,
    elevation: 4,
  },
  heroHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroLabel: {
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '600',
  },
  heroAmount: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  heroSubRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1F2937',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  heroPillText: {
    color: '#E5E7EB',
    fontSize: 12,
    fontWeight: '600',
  },
  balanceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  balanceTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  balanceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  balanceSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  balanceTotalValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  balanceDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  balanceDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  balanceDetailLabel: {
    fontSize: 12,
    color: '#4B5563',
  },
  balanceDetailAmount: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
  },
  resetBalanceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  resetBalanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricBox: {
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#111827',
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 10,
  },
  recentOriginDest: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
  },
  recentMeta: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  recentNet: {
    fontSize: 14,
    fontWeight: '800',
    color: '#16A34A',
  },
  recentGross: {
    fontSize: 11,
    color: '#6B7280',
  },
});
