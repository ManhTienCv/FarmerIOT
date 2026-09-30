// Quản lý lưu trữ dữ liệu cảm biến và thiết bị thực tế cục bộ (AsyncStorage).
// Thay thế hoàn toàn dữ liệu giả định (mock), lưu trữ các điểm đo thực từ ESP32 theo thời gian thực.

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SensorReading, SensorType, SensorHistoryPoint, DeviceState, DeviceType } from '@/types';

const STORAGE_KEY_LAST_SENSORS = '@farm_last_real_sensors';
const STORAGE_KEY_DEVICES = '@farm_real_devices';
const STORAGE_PREFIX_HISTORY = '@farm_real_history_';

const MAX_HISTORY_POINTS_PER_SENSOR = 150; // Giữ tối đa 150 điểm đo thực tế gần nhất

// Lưu dữ liệu cảm biến mới nhất từ ESP32
export async function saveRealSensors(sensors: SensorReading[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_LAST_SENSORS, JSON.stringify(sensors));

    // Đồng thời lưu lịch sử đo cho từng loại cảm biến
    for (const s of sensors) {
      await appendSensorHistoryPoint(s.type, s.value, s.updatedAt);
    }
  } catch (err) {
    console.warn('[Storage] Lỗi khi lưu dữ liệu cảm biến thực tế:', err);
  }
}

// Lấy dữ liệu cảm biến thực tế đã lưu gần nhất
export async function getStoredSensors(): Promise<SensorReading[] | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_LAST_SENSORS);
    if (!raw) return null;
    return JSON.parse(raw) as SensorReading[];
  } catch (err) {
    console.warn('[Storage] Lỗi khi đọc dữ liệu cảm biến lưu trữ:', err);
    return null;
  }
}

// Thêm một điểm đo thực tế vào chuỗi thời gian lịch sử
export async function appendSensorHistoryPoint(
  type: SensorType,
  value: number,
  isoTime?: string
): Promise<void> {
  try {
    const key = `${STORAGE_PREFIX_HISTORY}${type}`;
    const raw = await AsyncStorage.getItem(key);
    let points: SensorHistoryPoint[] = raw ? JSON.parse(raw) : [];

    const time = isoTime || new Date().toISOString();

    // Tránh lưu các điểm đo quá sát nhau (dưới 10 giây) để tiết kiệm dung lượng
    if (points.length > 0) {
      const lastPoint = points[points.length - 1];
      const diffMs = new Date(time).getTime() - new Date(lastPoint.time).getTime();
      if (Math.abs(diffMs) < 10000) {
        // Cập nhật giá trị điểm cuối thay vì thêm mới
        lastPoint.value = value;
        lastPoint.time = time;
        await AsyncStorage.setItem(key, JSON.stringify(points));
        return;
      }
    }

    points.push({ time, value });

    // Giữ số lượng điểm tối đa
    if (points.length > MAX_HISTORY_POINTS_PER_SENSOR) {
      points = points.slice(points.length - MAX_HISTORY_POINTS_PER_SENSOR);
    }

    await AsyncStorage.setItem(key, JSON.stringify(points));
  } catch (err) {
    console.warn(`[Storage] Lỗi khi lưu điểm lịch sử cho ${type}:`, err);
  }
}

// Lấy lịch sử đo thực tế cho biểu đồ
export async function getStoredHistory(
  type: SensorType,
  hours = 12
): Promise<SensorHistoryPoint[]> {
  try {
    const key = `${STORAGE_PREFIX_HISTORY}${type}`;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];

    const points: SensorHistoryPoint[] = JSON.parse(raw);
    if (!points.length) return [];

    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const filtered = points.filter((p) => new Date(p.time).getTime() >= cutoff);

    // Nếu các điểm đo thực tế có khoảng cách, sắp xếp theo thời gian tăng dần
    filtered.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

    return filtered.length > 0 ? filtered : points.slice(-12);
  } catch (err) {
    console.warn(`[Storage] Lỗi khi đọc lịch sử cho ${type}:`, err);
    return [];
  }
}

// Lưu trạng thái thiết bị thực tế
export async function saveRealDevices(devices: DeviceState[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_DEVICES, JSON.stringify(devices));
  } catch (err) {
    console.warn('[Storage] Lỗi khi lưu trạng thái thiết bị thực tế:', err);
  }
}

// Lấy trạng thái thiết bị thực tế đã lưu
export async function getStoredDevices(): Promise<DeviceState[] | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_DEVICES);
    if (!raw) return null;
    return JSON.parse(raw) as DeviceState[];
  } catch (err) {
    console.warn('[Storage] Lỗi khi đọc trạng thái thiết bị lưu trữ:', err);
    return null;
  }
}
