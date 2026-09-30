// Dịch vụ tích hợp Cơ sở dữ liệu (Cloud Supabase / Local PostgreSQL Bridge Server).
// Giúp lưu trữ lịch sử cảm biến 24/7 và đồng bộ trạng thái thiết bị đa nền tảng.
// 1. Thử kết nối Local Bridge (http://localhost:5001) khi chạy dev/web trên máy tính cá nhân.
// 2. Nếu không có Local Bridge, dùng Supabase (nếu đã cấu hình).
// 3. Dự phòng bằng AsyncStorage cục bộ (offline-first).

import type { SensorReading, SensorType, SensorHistoryPoint } from '@/types';
import { getStoredHistory, appendSensorHistoryPoint } from '@/services/historyStorage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
const LOCAL_API_URL = process.env.EXPO_PUBLIC_LOCAL_API_URL || 'http://localhost:5001';

export function isCloudDatabaseConfigured(): boolean {
  return !!(SUPABASE_URL && SUPABASE_KEY);
}

// Ghi nhận dữ liệu cảm biến vào Database
export async function logSensorTelemetryToDatabase(sensors: SensorReading[]): Promise<void> {
  // Luôn lưu vào bộ nhớ cục bộ
  for (const s of sensors) {
    await appendSensorHistoryPoint(s.type, s.value, s.updatedAt);
  }

  // Đẩy sang local bridge nếu server cục bộ đang mở
  try {
    const temp = sensors.find((s) => s.type === 'temperature')?.value;
    const airH = sensors.find((s) => s.type === 'airHumidity')?.value;
    const soilM = sensors.find((s) => s.type === 'soilMoisture')?.value;
    const light = sensors.find((s) => s.type === 'light')?.value;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    fetch(`${LOCAL_API_URL}/api/sensors/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        temperature: temp,
        air_humidity: airH,
        soil_moisture: soilM,
        light: light,
        recorded_at: new Date().toISOString(),
      }),
      signal: controller.signal,
    })
      .then(() => clearTimeout(timeoutId))
      .catch(() => clearTimeout(timeoutId));
  } catch {
    // Local bridge không chạy thì bỏ qua, ESP32 sẽ gửi trực tiếp qua MQTT
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

// Lấy lịch sử đo từ Database máy chủ cục bộ, Database đám mây hoặc bộ nhớ cục bộ
export async function fetchSensorHistory(
  type: SensorType,
  hours = 12
): Promise<SensorHistoryPoint[]> {
  // 1. Thử lấy từ Local Bridge PostgreSQL Server (http://localhost:5001)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const localRes = await fetch(`${LOCAL_API_URL}/api/sensors/history?type=${type}&hours=${hours}`, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (localRes.ok) {
      const localData = await localRes.json();
      if (Array.isArray(localData) && localData.length > 0) {
        return localData.map((d: any) => ({
          time: d.time,
          value: Number(d.value),
        }));
      }
    }
  } catch {
    // Server local không chạy hoặc timeout -> tiếp tục thử Cloud / AsyncStorage
  }

  // 2. Thử lấy từ Supabase Cloud Database (nếu đã cấu hình)
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

  // 3. Dự phòng: Đọc từ bộ nhớ thực tế AsyncStorage
  return getStoredHistory(type, hours);
}
