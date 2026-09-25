// Kiểu dữ liệu dùng chung cho toàn bộ ứng dụng AIoT Nông nghiệp

export type SensorType =
  | 'temperature'
  | 'airHumidity'
  | 'soilMoisture'
  | 'light';

export interface SensorReading {
  type: SensorType;
  value: number;
  unit: string;
  min: number;
  max: number;
  optimalMin: number;
  optimalMax: number;
  updatedAt: string;
}

export type DeviceType = 'pump' | 'growLight';

export interface DeviceState {
  type: DeviceType;
  label: string;
  isOn: boolean;
  lastToggledAt: string;
}

export type AlertLevel = 'info' | 'warning' | 'danger' | 'success';

export interface AIInsight {
  id: string;
  level: AlertLevel;
  title: string;
  description: string;
  confidence?: number;
  recommendation: string;
  createdAt: string;
}

export interface SensorHistoryPoint {
  time: string;
  value: number;
}

export * from './crop';
