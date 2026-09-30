// =========================================================================
// AIoT AGRICULTURE - 24/7 CLOUD BACKEND SERVICE (RENDER.COM & LOCAL)
// Hứng dữ liệu cảm biến & thiết bị từ ESP32 qua HiveMQ Cloud MQTT
// Tự động lưu 24/7 vào Supabase PostgreSQL Cloud
// Cung cấp REST API & Health Check cho Render và Frontend
// =========================================================================

const http = require('http');
const { Pool } = require('pg');
const mqtt = require('mqtt');
const fs = require('fs');
const path = require('path');

// 1. TỰ ĐỘNG ĐỌC BIẾN MÔI TRƯỜNG TỪ .env (NẾU CHẠY CỤC BỘ)
try {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [k, ...v] = trimmed.split('=');
        if (k && v.length) process.env[k.trim()] = v.join('=').trim();
      }
    });
  }
} catch (e) {}

// Cấu hình cổng: Render tự cấp biến PORT (thường là 10000), mặc định 5001 cho local
const PORT = process.env.PORT || 5001;

// Cấu hình Supabase Cloud (ưu tiên hàng đầu)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://honwrqrukyibnpatkven.supabase.co';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvbndycXJ1a3lpYm5wYXRrdmVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3MjgzNTIsImV4cCI6MjEwNjMwNDM1Mn0.JSQ_66FFDySIkeZd3g7a_tteb60EfCx6RYkFSUL4w38';

// Cấu hình HiveMQ Cloud MQTT
const MQTT_URL = process.env.MQTT_URL || 'mqtts://002ca57eb19d41ce82e81b3d1614d718.s1.eu.hivemq.cloud:8883';
const MQTT_OPTIONS = {
  username: process.env.MQTT_USERNAME || 'farmer',
  password: process.env.MQTT_PASSWORD || 'farmerbig12!',
  clientId: 'AiotCloudBackend_' + Math.random().toString(16).substring(2, 8),
  rejectUnauthorized: false,
  reconnectPeriod: 3000,
};

// 2. KẾT NỐI TÙY CHỌN TỚI POSTGRESQL (NẾU CÓ DATABASE_URL HOẶC LOCALHOST)
let pool = null;
let isLocalDbConnected = false;

if (process.env.DATABASE_URL || process.env.NODE_ENV !== 'production') {
  try {
    const config = process.env.DATABASE_URL
      ? { connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }
      : { user: 'postgres', password: '1205', host: 'localhost', port: 5432, database: 'FarmerIOT' };

    pool = new Pool(config);
    pool.connect().then(async (c) => {
      isLocalDbConnected = true;
      console.log('[PostgreSQL] Đã kết nối Database thành công!');
      c.release();
    }).catch((err) => {
      isLocalDbConnected = false;
      console.log('[PostgreSQL] Không có local DB, hệ thống sẽ lưu thẳng vào Supabase Cloud 24/7.');
    });
  } catch (err) {
    isLocalDbConnected = false;
  }
}

// 3. KẾT NỐI VÀ HỨNG DỮ LIỆU TỪ HIVEMQ CLOUD MQTT
let isMqttConnected = false;
const mqttClient = mqtt.connect(MQTT_URL, MQTT_OPTIONS);

mqttClient.on('connect', () => {
  isMqttConnected = true;
  console.log('[MQTT Cloud] Đã kết nối HiveMQ Cloud thành công!');

  mqttClient.subscribe(['farm/sensors', 'farm/state/+'], (err) => {
    if (err) console.error('[MQTT] Lỗi subscribe:', err);
    else console.log('[MQTT Cloud] Đang lắng nghe 24/7: farm/sensors và farm/state/+');
  });
});

mqttClient.on('error', (err) => {
  console.error('[MQTT Cloud] Lỗi kết nối MQTT:', err.message);
});

mqttClient.on('close', () => {
  isMqttConnected = false;
});

// Xử lý gói tin gửi về từ ESP32
mqttClient.on('message', async (topic, payload) => {
  const messageStr = payload.toString();

  try {
    const data = JSON.parse(messageStr);

    // Gói tin cảm biến từ ESP32 -> Lưu vào sensor_telemetry
    if (topic === 'farm/sensors') {
      const temp = data.temperature != null ? Number(data.temperature) : null;
      const hum = data.airHumidity != null ? Number(data.airHumidity) : null;
      const soil = data.soilMoisture != null ? Number(data.soilMoisture) : null;
      const light = data.light != null ? Number(data.light) : null;
      const recordedAt = data.updatedAt || new Date().toISOString();

      console.log(`[ESP32 -> Backend] Nhiệt độ=${temp}°C, Độ ẩm=${hum}%, Độ ẩm đất=${soil}%, Ánh sáng=${light}lx`);

      // 1. Lưu vào Supabase Cloud 24/7
      if (SUPABASE_URL && SUPABASE_KEY) {
        fetch(`${SUPABASE_URL}/rest/v1/sensor_telemetry`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            temperature: temp,
            air_humidity: hum,
            soil_moisture: soil,
            light: light,
            recorded_at: recordedAt,
          }),
        }).then(() => {
          console.log('[Supabase Cloud] Đã lưu bản tin cảm biến thành công!');
        }).catch((err) => {
          console.warn('[Supabase Cloud] Lỗi ghi telemetry:', err.message);
        });
      }

      // 2. Lưu vào PostgreSQL cục bộ (nếu có)
      if (pool && isLocalDbConnected) {
        pool.query(
          `INSERT INTO sensor_telemetry (temperature, air_humidity, soil_moisture, light, recorded_at) VALUES ($1, $2, $3, $4, $5)`,
          [temp, hum, soil, light, recordedAt]
        ).catch(() => {});
      }
    }

    // Gói tin trạng thái thiết bị -> Lưu vào device_events
    else if (topic.startsWith('farm/state/')) {
      const devType = topic.replace('farm/state/', '');
      const isOn = !!data.isOn;
      const toggledBy = data.sender || 'hardware';
      const recordedAt = data.lastToggledAt || new Date().toISOString();

      console.log(`[Thiết bị -> Backend] ${devType} -> ${isOn ? 'BẬT' : 'TẮT'} (Bởi ${toggledBy})`);

      // 1. Lưu vào Supabase Cloud
      if (SUPABASE_URL && SUPABASE_KEY) {
        fetch(`${SUPABASE_URL}/rest/v1/device_events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            device_type: devType,
            is_on: isOn,
            toggled_by: toggledBy,
            recorded_at: recordedAt,
          }),
        }).then(() => {
          console.log('[Supabase Cloud] Đã lưu sự kiện thiết bị thành công!');
        }).catch((err) => {
          console.warn('[Supabase Cloud] Lỗi ghi device event:', err.message);
        });
      }

      // 2. Lưu vào PostgreSQL cục bộ (nếu có)
      if (pool && isLocalDbConnected) {
        pool.query(
          `INSERT INTO device_events (device_type, is_on, toggled_by, recorded_at) VALUES ($1, $2, $3, $4)`,
          [devType, isOn, toggledBy, recordedAt]
        ).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[Backend] Lỗi parse JSON gói tin MQTT:', err.message);
  }
});

// 4. MÁY CHỦ HTTP REST API & HEALTH CHECK CHO RENDER
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Render Health Check Endpoint
  if (pathname === '/' || pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'online',
        service: 'AIoT Agriculture 24/7 Cloud Backend',
        database: 'Supabase PostgreSQL Cloud',
        mqtt: isMqttConnected ? 'connected' : 'connecting',
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // REST API: Lấy lịch sử cảm biến từ Supabase
  if (pathname === '/api/sensors/history') {
    const sensorType = parsedUrl.searchParams.get('type') || 'temperature';
    const hours = parseInt(parsedUrl.searchParams.get('hours') || '12', 10);
    const colMap = {
      temperature: 'temperature',
      airHumidity: 'air_humidity',
      soilMoisture: 'soil_moisture',
      light: 'light',
    };
    const col = colMap[sensorType] || 'temperature';
    const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    try {
      const resp = await fetch(
        `${SUPABASE_URL}/rest/v1/sensor_telemetry?select=${col},recorded_at&recorded_at=gte.${sinceIso}&order=recorded_at.asc&limit=200`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
          },
        }
      );
      const rows = await resp.json();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify(
          Array.isArray(rows)
            ? rows.map((r) => ({ time: r.recorded_at, value: Number(r[col]) }))
            : []
        )
      );
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

// Bắt lỗi không để server chết
process.on('uncaughtException', (err) => {
  console.error('[Backend Uncaught Error]:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[Backend Unhandled Rejection]:', reason);
});

// Bắt đầu lắng nghe
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n============================================================`);
  console.log(`🚀 AIoT CLOUD BACKEND SERVICE ĐANG CHẠY TRÊN PORT: ${PORT}`);
  console.log(`🌐 Supabase Cloud: ${SUPABASE_URL}`);
  console.log(`📡 HiveMQ Cloud: ${MQTT_URL}`);
  console.log(`🩺 Health check URL: http://0.0.0.0:${PORT}/health`);
  console.log(`============================================================\n`);
});
