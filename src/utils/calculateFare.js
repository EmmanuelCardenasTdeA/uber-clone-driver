import { PRICING_CONFIG } from "../config/pricing";

export const calculateFare = ({ distanceKm = 0, durationMin = 0, category = 'economy', tip = 0 } = {}) => {
  const {
    BASE_FARE,
    COST_PER_KM,
    COST_PER_MINUTE,
    MIN_FARE,
    MULTIPLIERS,
    COMMISSION_RATE,
  } = PRICING_CONFIG;

  const multiplier = MULTIPLIERS[category] || MULTIPLIERS.economy;
  const cleanTip = Math.max(0, Math.round(Number(tip) || 0));

  // Fórmula: max(min, (base + km * Vkm + min * Vmin) * Mcategoria)
  const rawSubtotal = (BASE_FARE + distanceKm * COST_PER_KM + durationMin * COST_PER_MINUTE) * multiplier;
  const rawFare = Math.max(MIN_FARE, rawSubtotal);

  // Redondear al múltiplo de 100 COP más cercano antes de calcular la comisión
  const fare = Math.round(rawFare / 100) * 100;

  // Comisión = tarifa * 0.20
  const commission = Math.round(fare * COMMISSION_RATE);

  // Ganancia neta = Tarifa - comisión + propina
  const driverEarnings = fare - commission + cleanTip;

  return {
    fare,
    commission,
    driverEarnings,
    commissionRate: COMMISSION_RATE,
  };
};

export default calculateFare;
