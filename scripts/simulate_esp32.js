/**
 * SIMULATOR ESP32 AIoT - TRẠM GIẢ LẬP PHẦN CỨNG CHO DƯA LƯỚI
 * 
 * Script này đóng vai trò như một vi điều khiển ESP32 vật lý:
 * 1. Kết nối an toàn qua TLS (port 8883) tới HiveMQ Cloud Broker.
 * 2. Đăng ký thông báo trạng thái "online" tại topic 'farm/status'.
 * 3. Phát dữ liệu cảm biến chuẩn nông học dưa lưới tới 'farm/sensors' mỗi 3 giây.
 * 4. Lắng nghe lệnh điều khiển máy bơm và đèn quang hợp từ Mobile App tại 'farm/control/#'
 *    và phản hồi trạng thái tại 'farm/state/#'.
 * 5. Tự động gửi trạng thái "offline" khi dừng script.
 */

const mqtt = require('mqtt');

const MQTT_HOST = 'mqtts://002ca57eb19d41ce82e81b3d1614d718.s1.eu.hivemq.cloud:8883';
const MQTT_USER = 'farmer';
const MQTT_PASS = 'farmerbig12!';

const TOPIC_SENSORS = 'farm/sensors';
const TOPIC_STATUS = 'farm/status';
const TOPIC_CONTROL_PREFIX = 'farm/control/';
const TOPIC_STATE_PREFIX = 'farm/state/';

// Trạng thái thiết bị giả lập
let pumpState = false;
let lightState = false;

console.log('================================================================');
console.log('🌱 [ESP32 SIMULATOR] KHỞI ĐỘNG TRẠM GIẢ LẬP PHẦN CỨNG DƯA LƯỚI');
console.log('🌱 Đang kết nối tới HiveMQ Cloud:', MQTT_HOST);
console.log('================================================================\n');

const client = mqtt.connect(MQTT_HOST, {
  username: MQTT_USER,
  password: MQTT_PASS,
  clientId: `esp32_hardware_${Math.random().toString(16).substring(2, 8)}`,
  clean: true,
  will: {
    topic: TOPIC_STATUS,
    payload: JSON.stringify({ online: false }),
    qos: 0,
    retain: false,
  },
});

client.on('connect', () => {
  console.log('[ESP32 STATUS] ✅ Đã kết nối thành công tới HiveMQ Cloud TLS cổng 8883!');
  console.log('[ESP32 STATUS] 📡 Đã phát gói tin trực tuyến lên topic: ' + TOPIC_STATUS);
  
  // 1. Phát trạng thái Online ngay lập tức
  client.publish(TOPIC_STATUS, JSON.stringify({ online: true }));

  // 2. Lắng nghe topic điều khiển từ điện thoại
  client.subscribe('farm/control/#', (err) => {
    if (!err) {
      console.log('[ESP32 STATUS] 👂 Đang lắng nghe lệnh điều khiển tại farm/control/#');
    }
  });

  // 3. Phát trạng thái thiết bị hiện tại
  client.publish(`${TOPIC_STATE_PREFIX}pump`, JSON.stringify({
    isOn: pumpState,
    lastToggledAt: new Date().toISOString(),
  }));
  client.publish(`${TOPIC_STATE_PREFIX}growLight`, JSON.stringify({
    isOn: lightState,
    lastToggledAt: new Date().toISOString(),
  }));

  console.log('\n🚀 BẮT ĐẦU PHÁT DỮ LIỆU TELEMETRY ĐỊNH KỲ (MỖI 3 GIÂY)...');
  console.log('----------------------------------------------------------------');

  // Vòng lặp phát Telemetry
  setInterval(() => {
    // Thêm chút dao động ngẫu nhiên nhỏ để dữ liệu sống động như cảm biến thật
    const tempJitter = (Math.random() * 0.4 - 0.2); // ±0.2°C
    const humJitter = (Math.random() * 1.0 - 0.5);  // ±0.5%
    const lightJitter = Math.floor(Math.random() * 300 - 150); // ±150 lux

    const temperature = Number((28.2 + tempJitter).toFixed(1));
    const airHumidity = Math.round(68.0 + humJitter);
    const soilMoisture = 65; // Đang ở ngưỡng lý tưởng
    const light = Math.max(1000, 32500 + lightJitter);

    // Tính nhanh VPD để hiển thị trên console (áp dụng công thức FAO Penman-Monteith)
    const svp = 0.61078 * Math.exp((17.27 * temperature) / (temperature + 237.3));
    const avp = svp * (airHumidity / 100);
    const vpd = Number((svp - avp).toFixed(2));

    const payload = {
      temperature,
      airHumidity,
      soilMoisture,
      light,
      updatedAt: new Date().toISOString(),
    };

    client.publish(TOPIC_SENSORS, JSON.stringify(payload));
    client.publish(TOPIC_STATUS, JSON.stringify({ online: true }));

    const now = new Date().toLocaleTimeString('vi-VN');
    console.log(
      `[${now}] 📊 TELEMETRY -> Temp: ${temperature}°C | Hum: ${airHumidity}% | Soil: ${soilMoisture}% | Light: ${light} lx | VPD: ${vpd} kPa (Tối ưu)`
    );
  }, 3000);
});

// Xử lý lệnh điều khiển nhận từ Mobile App
client.on('message', (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    const deviceType = topic.replace(TOPIC_CONTROL_PREFIX, '');

    if (deviceType === 'pump') {
      pumpState = !!data.isOn;
      console.log(`\n🔔 [ESP32 ACTION] Nhận lệnh từ App: MÁY BƠM -> ${pumpState ? '🟢 BẬT' : '🔴 TẮT'}`);
      client.publish(`${TOPIC_STATE_PREFIX}pump`, JSON.stringify({
        isOn: pumpState,
        lastToggledAt: new Date().toISOString(),
      }));
    } else if (deviceType === 'growLight') {
      lightState = !!data.isOn;
      console.log(`\n🔔 [ESP32 ACTION] Nhận lệnh từ App: ĐÈN QUANG HỢP -> ${lightState ? '🟢 BẬT' : '🔴 TẮT'}`);
      client.publish(`${TOPIC_STATE_PREFIX}growLight`, JSON.stringify({
        isOn: lightState,
        lastToggledAt: new Date().toISOString(),
      }));
    }
  } catch (e) {
    console.error('[ESP32 ERROR] Lỗi giải mã lệnh:', e.message);
  }
});

client.on('error', (err) => {
  console.error('[ESP32 ERROR] Lỗi kết nối MQTT:', err);
});

// Bắt sự kiện thoát để ngắt kết nối an toàn
process.on('SIGINT', () => {
  console.log('\n\n🛑 Đang ngắt kết nối và gửi tín hiệu ngoại tuyến (offline)...');
  client.publish(TOPIC_STATUS, JSON.stringify({ online: false }), {}, () => {
    client.end(true, () => {
      console.log('👋 Đã dừng trạm giả lập ESP32 thành công.');
      process.exit(0);
    });
  });
});
