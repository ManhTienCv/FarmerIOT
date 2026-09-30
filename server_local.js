// =========================================================================
// MÁY CHỦ CẦU NỐI CỤC BỘ (LOCAL POSTGRESQL & MQTT BRIDGE SERVER)
// Dành cho việc chạy và kiểm tra trực tiếp trên máy tính cá nhân (localhost)
// Tự động hứng dữ liệu từ HiveMQ Cloud -> Lưu vào PostgreSQL pgAdmin
// Cung cấp REST API cho Giao diện Web (port 8082) hiển thị lịch sử đo thực tế
// =========================================================================

const http = require('http');
const { Pool } = require('pg');
const mqtt = require('mqtt');

const PORT = 5001;

// 1. CẤU HÌNH DATABASE POSTGRESQL CỤC BỘ (pgAdmin)
const pool = new Pool({
  user: 'postgres',
  password: '1205',
  host: 'localhost',
  port: 5432,
  database: 'FarmerIOT',
});

// 2. CẤU HÌNH BROKER HIVEMQ CLOUD
const MQTT_URL = 'mqtts://002ca57eb19d41ce82e81b3d1614d718.s1.eu.hivemq.cloud:8883';
const MQTT_OPTIONS = {
  username: 'farmer',
  password: 'farmerbig12!',
  clientId: 'LocalBridgeServer_' + Math.random().toString(16).substring(2, 8),
  rejectUnauthorized: false,
};

let isDbConnected = false;
let isMqttConnected = false;

// Tự động khởi tạo bảng nếu chưa có
async function initDatabase() {
  try {
    const client = await pool.connect();
    isDbConnected = true;
    console.log('[PostgreSQL] Đã kết nối thành công tới Database: FarmerIOT (port 5432)!');

    await client.query(`
      CREATE TABLE IF NOT EXISTS sensor_telemetry (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        temperature NUMERIC(5, 2),
        air_humidity NUMERIC(5, 2),
        soil_moisture NUMERIC(5, 2),
        light NUMERIC(8, 2),
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sensor_telemetry_recorded_at 
      ON sensor_telemetry (recorded_at DESC);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS device_events (
        id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
        device_type TEXT NOT NULL,
        is_on BOOLEAN NOT NULL,
        toggled_by TEXT DEFAULT 'user',
        recorded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_device_events_recorded_at 
      ON device_events (recorded_at DESC);
    `);

    client.release();
    console.log('[PostgreSQL] Các bảng sensor_telemetry và device_events đã sẵn sàng!');
  } catch (err) {
    isDbConnected = false;
    console.error('[PostgreSQL] Lỗi kết nối database:', err.message);
  }
}

// 3. KẾT NỐI VÀ HỨNG DỮ LIỆU TỪ CLOUD MQTT
const mqttClient = mqtt.connect(MQTT_URL, MQTT_OPTIONS);

mqttClient.on('connect', () => {
  isMqttConnected = true;
  console.log('[MQTT Cloud] Đã kết nối HiveMQ Cloud thành công!');

  // Lắng nghe dữ liệu cảm biến và trạng thái thiết bị
  mqttClient.subscribe(['farm/sensors', 'farm/state/+'], (err) => {
    if (err) console.error('[MQTT] Lỗi subscribe:', err);
    else console.log('[MQTT Cloud] Đang lắng nghe topic: farm/sensors và farm/state/+');
  });
});

mqttClient.on('error', (err) => {
  console.error('[MQTT Cloud] Lỗi kết nối:', err.message);
});

mqttClient.on('message', async (topic, payload) => {
  const messageStr = payload.toString();

  try {
    const data = JSON.parse(messageStr);

    // Hứng dữ liệu cảm biến từ ESP32 -> Lưu vào bảng sensor_telemetry
    if (topic === 'farm/sensors') {
      const temp = data.temperature != null ? Number(data.temperature) : null;
      const hum = data.airHumidity != null ? Number(data.airHumidity) : null;
      const soil = data.soilMoisture != null ? Number(data.soilMoisture) : null;
      const light = data.light != null ? Number(data.light) : null;
      const recordedAt = data.updatedAt || new Date().toISOString();

      const query = `
        INSERT INTO sensor_telemetry (temperature, air_humidity, soil_moisture, light, recorded_at)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, recorded_at;
      `;
      const res = await pool.query(query, [temp, hum, soil, light, recordedAt]);
      console.log(
        `[PostgreSQL] + INSERT sensor_telemetry ID=${res.rows[0].id}: Nhiệt độ=${temp}°C, Độ ẩm khí=${hum}%, Độ ẩm đất=${soil}%, Ánh sáng=${light}lx`
      );
    }

    // Hứng trạng thái bật/tắt thiết bị -> Lưu vào bảng device_events
    else if (topic.startsWith('farm/state/')) {
      const devType = topic.replace('farm/state/', '');
      const isOn = !!data.isOn;
      const toggledBy = data.sender || 'hardware';
      const recordedAt = data.lastToggledAt || new Date().toISOString();

      const query = `
        INSERT INTO device_events (device_type, is_on, toggled_by, recorded_at)
        VALUES ($1, $2, $3, $4)
        RETURNING id;
      `;
      const res = await pool.query(query, [devType, isOn, toggledBy, recordedAt]);
      console.log(
        `[PostgreSQL] + INSERT device_events ID=${res.rows[0].id}: Thiết bị=${devType} -> ${isOn ? 'BẬT' : 'TẮT'}`
      );
    }
  } catch (err) {
    console.error('[Bridge] Lỗi xử lý bản tin MQTT:', err.message);
  }
});

// 4. MÁY CHỦ HTTP REST API CHO WEB/APP TRUY VẤN
const server = http.createServer(async (req, res) => {
  // CORS Headers
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

  // 1. Kiểm tra trạng thái máy chủ
  if (pathname === '/health' || pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'online',
        database: isDbConnected ? 'connected' : 'disconnected',
        databaseName: 'FarmerIOT',
        mqtt: isMqttConnected ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString(),
      })
    );
    return;
  }

  // 2. Lấy dữ liệu cảm biến mới nhất
  if (pathname === '/api/sensors/latest') {
    try {
      const q = 'SELECT * FROM sensor_telemetry ORDER BY recorded_at DESC LIMIT 1;';
      const result = await pool.query(q);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows[0] || null));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 3. Lấy lịch sử đo thực tế để vẽ đồ thị
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

    try {
      let q = `
        SELECT ${col} AS value, recorded_at AS time
        FROM sensor_telemetry
        WHERE recorded_at >= NOW() - INTERVAL '${hours} hours'
        ORDER BY recorded_at ASC
        LIMIT 200;
      `;
      let result = await pool.query(q);
      
      // Nếu trong khoảng ${hours} giờ chưa có dữ liệu mới, lấy 50 bản ghi gần nhất có trong database
      if (result.rows.length === 0) {
        const fallbackQ = `
          SELECT ${col} AS value, recorded_at AS time
          FROM sensor_telemetry
          ORDER BY recorded_at DESC
          LIMIT 50;
        `;
        const fallbackRes = await pool.query(fallbackQ);
        result = { rows: fallbackRes.rows.reverse() };
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify(
          result.rows.map((r) => ({
            time: r.time,
            value: Number(r.value),
          }))
        )
      );
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 4. Lấy lịch sử thiết bị
  if (pathname === '/api/devices/history') {
    try {
      const q = 'SELECT * FROM device_events ORDER BY recorded_at DESC LIMIT 50;';
      const result = await pool.query(q);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.rows));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // 5. Ghi nhận dữ liệu cảm biến thủ công (nếu cần gửi qua REST)
  if (pathname === '/api/sensors/telemetry' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const temp = payload.temperature != null ? Number(payload.temperature) : null;
        const hum = payload.air_humidity != null ? Number(payload.air_humidity) : null;
        const soil = payload.soil_moisture != null ? Number(payload.soil_moisture) : null;
        const light = payload.light != null ? Number(payload.light) : null;
        const recordedAt = payload.recorded_at || new Date().toISOString();

        const q = `
          INSERT INTO sensor_telemetry (temperature, air_humidity, soil_moisture, light, recorded_at)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id, recorded_at;
        `;
        const resInsert = await pool.query(q, [temp, hum, soil, light, recordedAt]);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id: resInsert.rows[0].id }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

// Khởi chạy server
initDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`\n============================================================`);
    console.log(`🚀 LOCAL BRIDGE SERVER ĐANG CHẠY TẠI: http://localhost:${PORT}`);
    console.log(`📊 Dữ liệu từ ESP32 sẽ tự động ghi vào Database 'FarmerIOT'`);
    console.log(`🔍 Mở pgAdmin: gõ "SELECT * FROM sensor_telemetry;" để xem!`);
    console.log(`============================================================\n`);
  });
});
