// Ánh xạ loại cảm biến -> metadata hiển thị (icon, nhãn, màu, đơn vị).
import {
  Thermometer,
  Droplets,
  Droplet,
  Sun,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { SensorType } from '@/types';
import { colors } from '@/constants/theme';

export interface SensorMeta {
  type: SensorType;
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  unit: string;
  decimals: number;
  hint: string;
}

export const sensorMeta: Record<SensorType, SensorMeta> = {
  temperature: {
    type: 'temperature',
    label: 'Nhiệt độ',
    icon: Thermometer,
    color: colors.sun[500],
    bg: 'rgba(217,130,43,0.10)',
    unit: '°C',
    decimals: 1,
    hint: 'Cảm biến SHT31',
  },
  airHumidity: {
    type: 'airHumidity',
    label: 'Độ ẩm không khí',
    icon: Droplets,
    color: colors.water[500],
    bg: 'rgba(46,134,171,0.10)',
    unit: '%',
    decimals: 0,
    hint: 'Cảm biến SHT31',
  },
  soilMoisture: {
    type: 'soilMoisture',
    label: 'Độ ẩm đất',
    icon: Droplet,
    color: colors.soil[500],
    bg: 'rgba(141,110,99,0.10)',
    unit: '%',
    decimals: 0,
    hint: 'Cảm biến đất',
  },
  light: {
    type: 'light',
    label: 'Ánh sáng',
    icon: Sun,
    color: colors.sun[500],
    bg: 'rgba(217,130,43,0.10)',
    unit: 'lx',
    decimals: 0,
    hint: 'Cảm biến BH1750',
  },
};

export type SensorStatus = 'optimal' | 'low' | 'high';

export function getSensorStatus(value: number, min: number, max: number): SensorStatus {
  if (value < min) return 'low';
  if (value > max) return 'high';
  return 'optimal';
}

export const statusLabel: Record<SensorStatus, string> = {
  optimal: 'Tối ưu',
  low: 'Thấp',
  high: 'Cao',
};

export const statusColor: Record<SensorStatus, string> = {
  optimal: colors.success,
  low: colors.warning,
  high: colors.danger,
};
