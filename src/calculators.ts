import { SystemConfig, Location } from './types';
import { calculateDistance } from './geoUtils';

export const calculateTatTarget = (distanceKm: number, config: SystemConfig): number => {
  const brackets = [...(config.tatBrackets || [])].sort((a, b) => a.maxKm - b.maxKm);
  const matchedBracket = brackets.find(b => distanceKm <= b.maxKm);
  return matchedBracket ? matchedBracket.tatMinutes : (config.standardTatMinutes || 180);
};

export const calculateIncentive = (
  distanceKm: number,
  totalMins: number,
  tatTarget: number,
  isPriority: boolean,
  config: SystemConfig
): number => {
  const rate = totalMins <= tatTarget ? config.withinTatRate : config.outsideTatRate;
  const priorityMultiplier = isPriority ? 1.5 : 1;
  return (config.baseIncentive || 0) + (distanceKm * rate * priorityMultiplier);
};

export const calculateConvenienceFee = (distanceKm: number, config: SystemConfig): { minKm: number, maxKm: number, fee: number, label: string } => {
  if (!config.convenienceMatrix || config.convenienceMatrix.length === 0) {
    return { minKm: 0, maxKm: 999, fee: config.flatCollectionCharge || 0, label: 'Standard' };
  }
  const brackets = [...config.convenienceMatrix].sort((a, b) => a.maxKm - b.maxKm);
  const matchedBracket = brackets.find(t => distanceKm >= t.minKm && distanceKm < t.maxKm);
  return matchedBracket || brackets[brackets.length - 1];
};
