// Dịch vụ tích hợp Cơ sở dữ liệu đám mây (Cloud Database - Supabase / PostgreSQL).
// Giúp lưu trữ lịch sử cảm biến 24/7 và đồng bộ trạng thái thiết bị đa nền tảng.
// Nếu chưa cấu hình Supabase URL/Key, hệ thống sẽ tự động dùng AsyncStorage (cục bộ).

import type { SensorReading, SensorType, SensorHistoryPoint, DeviceState } from '@/types';
import { getStoredHistory, appendSensorHistoryPoint } from '@/services/historyStorage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export function isCloudDatabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_KEY);
}

// Ghi nhận dữ liệu cảm biến vào Database
export async function logSensorTelemetryToDatabase(sensors: SensorReading[]): Promise<void> {
  // Luôn lưu vào bộ nhớ cục bộ
  for (const s of sensors) {
    await appendSensorHistoryPoint(s.type, s.value, s.updatedAt);
  }

  // Nếu có cấu hình Cloud Database (Supabase)
  if (isCloudDatabaseConfigured()) {
    try {
      const temp = sensors.find((s) => s.type === 'temperature')?.value;
      const airH = sensors.find((s) => s.type === 'airHumidity')?.value;
      const soilM = sensors.find((s) => s.type === 'soilMoisture')?.value;
      const light = sensors.find((s) => s.type === 'light')?.value;

      await fetch(`${SUPABASE_URL}/rest/v1/sensor_telemetry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          temperature: temp,
          air_humidity: airH,
          soil_moisture: soilM,
          light: light,
          recorded_at: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.warn('[Database] Lỗi khi đồng bộ telemetry lên Supabase:', err);
    }
  }
}

// Lấy lịch sử đo từ Database đám mây hoặc bộ nhớ cục bộ
export async function fetchSensorHistory(
  type: SensorType,
  hours = 12
): Promise<SensorHistoryPoint[]> {
  if (isCloudDatabaseConfigured()) {
    try {
      const columnMap: Record<SensorType, string> = {
        temperature: 'temperature',
        airHumidity: 'air_humidity',
        soilMoisture: 'soil_moisture',
        light: 'light',
      };
      const col = columnMap[type];
      const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/sensor_telemetry?select=${col},recorded_at&recorded_at=gte.${sinceIso}&order=recorded_at.asc&limit=100`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        }
      );

      if (res.ok) {
        const rows: any[] = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          return rows.map((r) => ({
            time: r.recorded_at,
            value: Number(r[col]),
          }));
        }
      }
    } catch (err) {
      console.warn('[Database] Lỗi khi truy vấn Supabase, chuyển sang bộ nhớ cục bộ:', err);
    }
  }

  // Dự phòng: Đọc từ bộ nhớ thực tế AsyncStorage
  return getStoredHistory(type, hours);
}
