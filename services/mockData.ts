// Dữ liệu giả lập cho cảm biến, thiết bị và AI chẩn đoán.
// Dùng khi chưa kết nối phần cứng. Giá trị thay đổi nhẹ mỗi lần gọi
// để mô phỏng dữ liệu thời gian thực.

import type {
  SensorReading,
  SensorType,
  DeviceState,
  AIInsight,
  SensorHistoryPoint,
} from '@/types';

function jitter(base: number, range: number): number {
  return +(base + (Math.random() - 0.5) * range).toFixed(1);
}

export function mockSensors(): SensorReading[] {
  const now = new Date().toISOString();
  return [
    {
      type: 'temperature',
      value: jitter(28.4, 1.2),
      unit: '°C',
      min: 0,
      max: 50,
      optimalMin: 22,
      optimalMax: 32,
      updatedAt: now,
    },
    {
      type: 'airHumidity',
      value: jitter(78, 6),
      unit: '%',
      min: 0,
      max: 100,
      optimalMin: 60,
      optimalMax: 80,
      updatedAt: now,
    },
    {
      type: 'soilMoisture',
      value: jitter(34, 5),
      unit: '%',
      min: 0,
      max: 100,
      optimalMin: 45,
      optimalMax: 70,
      updatedAt: now,
    },
    {
      type: 'light',
      value: jitter(12400, 800),
      unit: 'lx',
      min: 0,
      max: 65535,
      optimalMin: 10000,
      optimalMax: 25000,
      updatedAt: now,
    },
  ];
}

export function mockDevices(): DeviceState[] {
  const now = new Date().toISOString();
  return [
    { type: 'pump', label: 'Máy bơm nước', isOn: false, lastToggledAt: now },
    { type: 'growLight', label: 'Đèn quang hợp', isOn: true, lastToggledAt: now },
  ];
}

export function mockInsights(): AIInsight[] {
  return [
    {
      id: '1',
      level: 'danger',
      title: 'Nguy cơ nấm lá cao',
      description: 'Độ ẩm không khí 78% kéo dài làm tăng nguy cơ nấm lá (Anthracnose).',
      confidence: 85,
      recommendation: 'Bật quạt thông gió và giảm tưới trong 2 giờ tới.',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      level: 'warning',
      title: 'Đất đang khô',
      description: 'Độ ẩm đất 34% dưới ngưỡng tối ưu (45–70%).',
      confidence: 72,
      recommendation: 'Bật máy bơm tưới 10–15 phút để phục hồi độ ẩm.',
      createdAt: new Date().toISOString(),
    },
    {
      id: '3',
      level: 'success',
      title: 'Ánh sáng lý tưởng',
      description: 'Cường độ ánh sáng 12.400 lux nằm trong vùng tối ưu.',
      confidence: 94,
      recommendation: 'Không cần bật đèn quang hợp vào lúc này.',
      createdAt: new Date().toISOString(),
    },
    {
      id: '4',
      level: 'info',
      title: 'Lịch tưới khuyến nghị',
      description: 'Dự báo thời tiết nắng, nhiệt độ 28–31°C trong 3 ngày tới.',
      recommendation: 'Tưới 2 lần/ngày vào 6:00 và 17:00 để giữ ẩm đất.',
      createdAt: new Date().toISOString(),
    },
  ];
}

export function mockHistory(type: SensorType, hours: number): SensorHistoryPoint[] {
  const points: SensorHistoryPoint[] = [];
  const now = Date.now();
  const base: Record<SensorType, number> = {
    temperature: 28,
    airHumidity: 76,
    soilMoisture: 38,
    light: 12000,
  };
  const amp: Record<SensorType, number> = {
    temperature: 2,
    airHumidity: 6,
    soilMoisture: 8,
    light: 1500,
  };
  const count = Math.min(hours * 4, 48);
  for (let i = count - 1; i >= 0; i--) {
    const t = new Date(now - i * 15 * 60 * 1000);
    const wave = Math.sin((i / count) * Math.PI * 4) * amp[type];
    const noise = (Math.random() - 0.5) * amp[type] * 0.4;
    points.push({
      time: `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`,
      value: Math.round((base[type] + wave + noise) * 10) / 10,
    });
  }
  return points;
}
