import Paho from 'paho-mqtt';
import type { SensorReading, DeviceState, DeviceType } from '@/types';
import {
  saveRealSensors,
  getStoredSensors,
  saveRealDevices,
  getStoredDevices,
} from '@/services/historyStorage';
import { logSensorTelemetryToDatabase } from '@/services/databaseService';

// ============================================================
// CẤU HÌNH HIVEMQ CLOUD BROKER
// ============================================================
const MQTT_HOST =
  process.env.EXPO_PUBLIC_MQTT_HOST || '002ca57eb19d41ce82e81b3d1614d718.s1.eu.hivemq.cloud';
const MQTT_PORT = Number(process.env.EXPO_PUBLIC_MQTT_PORT) || 8884;
const MQTT_PATH = process.env.EXPO_PUBLIC_MQTT_PATH || '/mqtt';
const MQTT_USERNAME = process.env.EXPO_PUBLIC_MQTT_USERNAME || 'farmer';
const MQTT_PASSWORD = process.env.EXPO_PUBLIC_MQTT_PASSWORD || 'farmerbig12!';

// Topics chuẩn hoá
export const TOPIC_SENSORS = 'farm/sensors';
export const TOPIC_CONTROL_PREFIX = 'farm/control/';
export const TOPIC_STATE_PREFIX = 'farm/state/';
export const TOPIC_STATE_WILDCARD = 'farm/state/+';

// ============================================================
// TRẠNG THÁI NỘI BỘ VÀ LISTENER
// ============================================================
let client: Paho.Client | null = null;
let isConnected = false;
let isConnecting = false;
let reconnectTimer: any = null;

// Cache dữ liệu mới nhất nhận từ MQTT
let latestSensors: SensorReading[] | null = null;
const latestDevices: Record<DeviceType, DeviceState> = {
  pump: {
    type: 'pump',
    label: 'Máy bơm nước',
    isOn: false,
    lastToggledAt: new Date().toISOString(),
  },
  growLight: {
    type: 'growLight',
    label: 'Đèn quang hợp',
    isOn: false,
    lastToggledAt: new Date().toISOString(),
  },
};

type SensorListener = (sensors: SensorReading[]) => void;
type DeviceListener = (device: DeviceState) => void;
type ConnectionListener = (connected: boolean) => void;

const sensorListeners = new Set<SensorListener>();
const deviceListeners = new Set<DeviceListener>();
const connectionListeners = new Set<ConnectionListener>();

function notifyConnection(status: boolean) {
  isConnected = status;
  connectionListeners.forEach((listener) => {
    try {
      listener(status);
    } catch (err) {
      console.warn('[MQTT] Lỗi trong connectionListener:', err);
    }
  });
}

function notifySensors(sensors: SensorReading[]) {
  latestSensors = sensors;
  saveRealSensors(sensors).catch(() => {});
  logSensorTelemetryToDatabase(sensors).catch(() => {});

  sensorListeners.forEach((listener) => {
    try {
      listener(sensors);
    } catch (err) {
      console.warn('[MQTT] Lỗi trong sensorListener:', err);
    }
  });
}

function notifyDevice(device: DeviceState) {
  latestDevices[device.type] = device;
  saveRealDevices([latestDevices.pump, latestDevices.growLight]).catch(() => {});

  deviceListeners.forEach((listener) => {
    try {
      listener(device);
    } catch (err) {
      console.warn('[MQTT] Lỗi trong deviceListener:', err);
    }
  });
}

// Khởi động: Đọc các chỉ số thực tế đã lưu trước đó từ bộ nhớ cục bộ
getStoredSensors()
  .then((stored) => {
    if (stored && stored.length > 0 && !latestSensors) {
      latestSensors = stored;
    }
  })
  .catch(() => {});

getStoredDevices()
  .then((stored) => {
    if (stored && stored.length > 0) {
      for (const d of stored) {
        latestDevices[d.type] = d;
      }
    }
  })
  .catch(() => {});

// ============================================================
// HÀM CHUYỂN ĐỔI DỮ LIỆU TELEMETRY TỪ ESP32
// ============================================================
export function parseSensorPayload(raw: any): SensorReading[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  const now = raw.updatedAt || new Date().toISOString();
  return [
    {
      type: 'temperature',
      value: typeof raw.temperature === 'number' ? Number(raw.temperature.toFixed(1)) : 28.0,
      unit: '°C',
      min: 0,
      max: 50,
      optimalMin: 22,
      optimalMax: 32,
      updatedAt: now,
    },
    {
      type: 'airHumidity',
      value: typeof raw.airHumidity === 'number' ? Math.round(raw.airHumidity) : 75,
      unit: '%',
      min: 0,
      max: 100,
      optimalMin: 60,
      optimalMax: 80,
      updatedAt: now,
    },
    {
      type: 'soilMoisture',
      value: typeof raw.soilMoisture === 'number' ? Math.round(raw.soilMoisture) : 60,
      unit: '%',
      min: 0,
      max: 100,
      optimalMin: 45,
      optimalMax: 70,
      updatedAt: now,
    },
    {
      type: 'light',
      value: typeof raw.light === 'number' ? Math.round(raw.light) : 12000,
      unit: 'lx',
      min: 0,
      max: 65535,
      optimalMin: 10000,
      optimalMax: 25000,
      updatedAt: now,
    },
  ];
}

// ============================================================
// KHỞI TẠO VÀ KẾT NỐI BROKER
// ============================================================
export function connectMqtt(): void {
  if (isConnected || isConnecting) return;

  // Tạo clientId ngẫu nhiên dưới 23 ký tự theo chuẩn MQTT
  const clientId = `farm_${Math.random().toString(16).substring(2, 10)}`;

  try {
    isConnecting = true;
    client = new Paho.Client(MQTT_HOST, MQTT_PORT, MQTT_PATH, clientId);

    client.onConnectionLost = (responseObject) => {
      isConnecting = false;
      notifyConnection(false);
      console.warn('[MQTT] Mất kết nối tới HiveMQ Cloud:', responseObject.errorMessage);

      // Thử kết nối lại sau 5 giây nếu không phải do disconnect chủ động
      if (responseObject.errorCode !== 0) {
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          connectMqtt();
        }, 5000);
      }
    };

    client.onMessageArrived = (message: Paho.Message) => {
      const topic = message.destinationName;
      const payloadStr = message.payloadString;

      try {
        const data = JSON.parse(payloadStr);

        // Nhận dữ liệu cảm biến
        if (topic === TOPIC_SENSORS) {
          const parsed = parseSensorPayload(data);
          notifySensors(parsed);
        }
        // Nhận phản hồi trạng thái thiết bị từ ESP32 (vd: farm/state/pump)
        else if (topic.startsWith(TOPIC_STATE_PREFIX)) {
          const type = topic.replace(TOPIC_STATE_PREFIX, '') as DeviceType;
          if (type === 'pump' || type === 'growLight') {
            const devState: DeviceState = {
              type,
              label: type === 'pump' ? 'Máy bơm nước' : 'Đèn quang hợp',
              isOn: !!data.isOn,
              lastToggledAt: data.lastToggledAt || new Date().toISOString(),
            };
            notifyDevice(devState);
          }
        }
      } catch (err) {
        console.warn(`[MQTT] Không thể giải mã JSON từ topic ${topic}:`, payloadStr);
      }
    };

    client.connect({
      useSSL: true,
      userName: MQTT_USERNAME,
      password: MQTT_PASSWORD,
      keepAliveInterval: 30,
      cleanSession: true,
      timeout: 10,
      onSuccess: () => {
        isConnecting = false;
        notifyConnection(true);
        console.log('[MQTT] Kết nối thành công tới HiveMQ Cloud!');

        // Đăng ký nhận dữ liệu cảm biến và phản hồi thiết bị
        if (client) {
          client.subscribe(TOPIC_SENSORS, { qos: 0 });
          client.subscribe(TOPIC_STATE_WILDCARD, { qos: 0 });
        }
      },
      onFailure: (err) => {
        isConnecting = false;
        notifyConnection(false);
        console.warn('[MQTT] Kết nối thất bại:', err.errorMessage);

        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          connectMqtt();
        }, 7000);
      },
    });
  } catch (err) {
    isConnecting = false;
    notifyConnection(false);
    console.error('[MQTT] Lỗi khởi tạo client:', err);
  }
}

export function disconnectMqtt(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (client && isConnected) {
    try {
      client.disconnect();
    } catch (e) {
      // bỏ qua
    }
  }
  isConnected = false;
  isConnecting = false;
  notifyConnection(false);
}

// ============================================================
// GỬI LỆNH ĐIỀU KHIỂN (PUBLISH COMMAND)
// ============================================================
export async function sendMqttDeviceCommand(type: DeviceType, isOn: boolean): Promise<boolean> {
  if (!client || !isConnected) {
    return false;
  }

  try {
    const topic = `${TOPIC_CONTROL_PREFIX}${type}`;
    const payload = JSON.stringify({
      isOn,
      type,
      sender: 'app',
      timestamp: new Date().toISOString(),
    });

    const message = new Paho.Message(payload);
    message.destinationName = topic;
    message.qos = 1;
    client.send(message);

    // Cập nhật optimistic local state ngay lập tức
    latestDevices[type] = {
      type,
      label: type === 'pump' ? 'Máy bơm nước' : 'Đèn quang hợp',
      isOn,
      lastToggledAt: new Date().toISOString(),
    };
    notifyDevice(latestDevices[type]);

    return true;
  } catch (err) {
    console.error(`[MQTT] Lỗi gửi lệnh cho ${type}:`, err);
    return false;
  }
}

export async function sendMqttModeCommand(mode: 'auto' | 'manual'): Promise<boolean> {
  if (!client || !isConnected) return false;
  try {
    const topic = `${TOPIC_CONTROL_PREFIX}mode`;
    const payload = JSON.stringify({ mode, sender: 'app' });
    const message = new Paho.Message(payload);
    message.destinationName = topic;
    message.qos = 1;
    client.send(message);
    return true;
  } catch (err) {
    console.error('[MQTT] Lỗi gửi chế độ hoạt động:', err);
    return false;
  }
}

export async function sendMqttRainLock(rainLock: boolean): Promise<boolean> {
  if (!client || !isConnected) return false;
  try {
    const topic = `${TOPIC_CONTROL_PREFIX}rainLock`;
    const payload = JSON.stringify({ rainLock, sender: 'app' });
    const message = new Paho.Message(payload);
    message.destinationName = topic;
    message.qos = 1;
    client.send(message);
    return true;
  } catch (err) {
    console.error('[MQTT] Lỗi gửi khóa mưa:', err);
    return false;
  }
}

// ============================================================
// HÀM ĐĂNG KÝ LISTENER DÀNH CHO REACT COMPONENTS
// ============================================================
export function subscribeSensors(callback: SensorListener): () => void {
  sensorListeners.add(callback);
  if (latestSensors) {
    callback(latestSensors);
  }
  return () => {
    sensorListeners.delete(callback);
  };
}

export function subscribeDevices(callback: DeviceListener): () => void {
  deviceListeners.add(callback);
  callback(latestDevices.pump);
  callback(latestDevices.growLight);
  return () => {
    deviceListeners.delete(callback);
  };
}

export function subscribeConnection(callback: ConnectionListener): () => void {
  connectionListeners.add(callback);
  callback(isConnected);
  return () => {
    connectionListeners.delete(callback);
  };
}

export function isMqttActive(): boolean {
  return isConnected;
}

export function getCachedSensors(): SensorReading[] | null {
  return latestSensors;
}

export function getCachedDevices(): DeviceState[] {
  return [latestDevices.pump, latestDevices.growLight];
}
