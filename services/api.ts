// Lớp giao tiếp với Backend AIoT (ESP32 / Node-RED / REST API nội bộ).
// Hỗ trợ cả chế độ giả lập (Mock) và kết nối trực tiếp với ESP32 qua Wi-Fi LAN.

import type {
  SensorReading,
  DeviceState,
  DeviceType,
  AIInsight,
  SensorHistoryPoint,
  SensorType,
} from '@/types';
import { mockSensors, mockDevices, mockInsights, mockHistory } from '@/services/mockData';
import {
  getCachedSensors,
  getCachedDevices,
  sendMqttDeviceCommand,
  isMqttActive,
} from '@/services/mqttService';
import { getStoredSensors, getStoredDevices } from '@/services/historyStorage';
import { fetchSensorHistory } from '@/services/databaseService';

// ============================================================
// CẤU HÌNH KẾT NỐI BACKEND
// ============================================================
// Đổi BASE_URL thành địa chỉ IP mạng LAN của ESP32 khi nạp thật (ví dụ: 'http://192.168.1.100/api')
export let BASE_URL = 'http://192.168.1.100/api';

// Bật/tắt dùng mock data. Mặc định là false để sử dụng 100% dữ liệu thực tế từ vườn.
export let USE_MOCK = false;

// Thời gian timeout tối đa cho mỗi request đến ESP32 (mili-giây)
const REQUEST_TIMEOUT_MS = 5000;

export function setBaseUrl(url: string) {
  BASE_URL = url.endsWith('/') ? url.slice(0, -1) : url;
}

export function getBaseUrl(): string {
  return BASE_URL;
}

export function setUseMock(useMock: boolean) {
  USE_MOCK = useMock;
}

export function getUseMock(): boolean {
  return USE_MOCK;
}

// ============================================================
// HÀM GỌI API AN TOÀN VỚI TIMEOUT & ERROR CATCHING NÂNG CAO
// ============================================================

export class ApiError extends Error {
  status?: number;
  isTimeout: boolean;
  isNetworkError: boolean;
  endpoint: string;

  constructor(
    message: string,
    options: {
      status?: number;
      isTimeout?: boolean;
      isNetworkError?: boolean;
      endpoint: string;
    }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = options.status;
    this.isTimeout = !!options.isTimeout;
    this.isNetworkError = !!options.isNetworkError;
    this.endpoint = options.endpoint;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const url = `${BASE_URL}${path}`;
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      signal: controller.signal,
      ...options,
    });

    if (!res.ok) {
      throw new ApiError(`Lỗi HTTP ${res.status}: Máy chủ ESP32 phản hồi lỗi tại ${path}`, {
        status: res.status,
        endpoint: path,
      });
    }

    try {
      return (await res.json()) as T;
    } catch (parseErr: any) {
      throw new ApiError(
        `Lỗi định dạng JSON từ ESP32 tại ${path}: ${parseErr?.message || 'Invalid JSON format'}`,
        { endpoint: path }
      );
    }
  } catch (error: any) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error.name === 'AbortError') {
      throw new ApiError(
        `Hết thời gian chờ (${REQUEST_TIMEOUT_MS / 1000}s) khi kết nối tới ESP32 tại ${BASE_URL}`,
        { isTimeout: true, endpoint: path }
      );
    }
    throw new ApiError(
      `Lỗi kết nối mạng tới ESP32 (${error.message || 'Network request failed'}). Vui lòng kiểm tra IP và Wi-Fi.`,
      { isNetworkError: true, endpoint: path }
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------- Cảm biến ----------
export async function getSensors(): Promise<SensorReading[]> {
  // 1. Dữ liệu thời gian thực nhận từ MQTT Cloud
  const cached = getCachedSensors();
  if (cached && cached.length > 0) {
    return cached;
  }
  // 2. Dữ liệu thực tế đã lưu trước đó trong bộ nhớ
  const stored = await getStoredSensors();
  if (stored && stored.length > 0) {
    return stored;
  }
  // 3. Nếu bật cờ giả lập thủ công
  if (USE_MOCK) return mockSensors();

  // 4. Thử gọi API LAN nội bộ nếu có
  try {
    return await request<SensorReading[]>('/sensors');
  } catch {
    return [];
  }
}

export async function getSensorHistory(
  type: SensorType,
  hours = 12,
): Promise<SensorHistoryPoint[]> {
  // 1. Lấy dữ liệu lịch sử thực tế từ Cloud Database (Supabase) hoặc AsyncStorage
  const history = await fetchSensorHistory(type, hours);
  if (history && history.length > 0) {
    return history;
  }
  // 2. Nếu bật mock
  if (USE_MOCK) return mockHistory(type, hours);

  return [];
}

// ---------- Thiết bị ----------
export async function getDevices(): Promise<DeviceState[]> {
  if (isMqttActive()) {
    const cached = getCachedDevices();
    if (cached && cached.length > 0) return cached;
  }
  const stored = await getStoredDevices();
  if (stored && stored.length > 0) return stored;

  if (USE_MOCK) return mockDevices();

  try {
    return await request<DeviceState[]>('/devices');
  } catch {
    return [
      { type: 'pump', label: 'Máy bơm nước', isOn: false, lastToggledAt: '' },
      { type: 'growLight', label: 'Đèn quang hợp', isOn: false, lastToggledAt: '' },
    ];
  }
}

export async function toggleDevice(type: DeviceType, isOn: boolean): Promise<DeviceState> {
  if (isMqttActive()) {
    const ok = await sendMqttDeviceCommand(type, isOn);
    if (ok) {
      return {
        type,
        label: type === 'pump' ? 'Máy bơm nước' : 'Đèn quang hợp',
        isOn,
        lastToggledAt: new Date().toISOString(),
      };
    }
  }
  if (USE_MOCK) {
    // Giả lập độ trễ phần cứng
    await new Promise((r) => setTimeout(r, 250));
    return {
      type,
      label: type === 'pump' ? 'Máy bơm nước' : 'Đèn quang hợp',
      isOn,
      lastToggledAt: new Date().toISOString(),
    };
  }
  return request<DeviceState>(`/devices/${type}`, {
    method: 'POST',
    body: JSON.stringify({ isOn }),
  });
}

import { analyzeAgricultureData, type AIAnalysisResult, type PrecisionCropContext } from '@/services/aiService';
import type { OutdoorWeather } from '@/services/weather';

// ---------- AI Chẩn đoán Đa Nền Tảng (Gemini -> Groq -> Local) ----------
export async function getAIAnalysis(
  sensors?: SensorReading[],
  weather?: OutdoorWeather,
  cropContext?: PrecisionCropContext
): Promise<AIAnalysisResult> {
  const currentSensors = sensors && sensors.length > 0 ? sensors : await getSensors();
  return analyzeAgricultureData(currentSensors, weather, cropContext);
}

export async function getAIInsights(): Promise<AIInsight[]> {
  const analysis = await getAIAnalysis();
  return analysis.insights;
}

// ---------- Hiệu chuẩn Cảm biến Độ ẩm đất (Soil Calibration) ----------
export interface SoilCalibrationData {
  dry: number;
  wet: number;
  currentRaw?: number;
  currentPercent?: number;
}

export async function getSoilCalibration(): Promise<SoilCalibrationData> {
  if (USE_MOCK) {
    return { dry: 3200, wet: 1200, currentRaw: 2200, currentPercent: 50 };
  }
  return request<SoilCalibrationData>('/sensors/soil/calibration');
}

export async function setSoilCalibration(data: { dry: number; wet: number }): Promise<void> {
  if (USE_MOCK) return;
  await request<{ status: string }>('/sensors/soil/calibration', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

