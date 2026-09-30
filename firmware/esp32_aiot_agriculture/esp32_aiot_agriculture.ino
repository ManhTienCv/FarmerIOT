/*
 * =========================================================================================
 * DỰ ÁN: NÔNG NGHIỆP THÔNG MINH AIoT (SMART AGRICULTURE)
 * PHẦN CỨNG: ESP32 + SHT31 + BH1750 + CẢM BIẾN ĐỘ ẨM ĐẤT + RELAY 2 KÊNH
 * GIAO THỨC: REST API HTTP SERVER (Tương thích 100% với Expo/React Native App)
 * =========================================================================================
 */

#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <PubSubClient.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_SHT31.h>
#include <BH1750.h>
#include <LiquidCrystal_I2C.h>
#include <time.h>

// ==========================================
// 1. CẤU HÌNH WI-FI (THAY ĐỔI THEO MẠNG CỦA BẠN)
// ==========================================
const char* WIFI_SSID = "YOUR_WIFI_NAME";        // Tên Wi-Fi nhà bạn
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"; // Mật khẩu Wi-Fi

// ==========================================
// 1.1. CẤU HÌNH HIVEMQ CLOUD MQTT (GLOBAL 24/7)
// ==========================================
const char* MQTT_SERVER = "002ca57eb19d41ce82e81b3d1614d718.s1.eu.hivemq.cloud";
const int MQTT_PORT = 8883; // Port MQTTS (Bảo mật SSL/TLS)
const char* MQTT_USER = "farmer";
const char* MQTT_PASS = "farmerbig12!";

const char* TOPIC_SENSORS = "farm/sensors";
const char* TOPIC_CONTROL_PUMP = "farm/control/pump";
const char* TOPIC_CONTROL_LIGHT = "farm/control/growLight";
const char* TOPIC_STATE_PUMP = "farm/state/pump";
const char* TOPIC_STATE_LIGHT = "farm/state/growLight";

// ==========================================
// 2. CẤU HÌNH CHÂN PHẦN CỨNG (PINOUT)
// ==========================================
// I2C DÙNG CHUNG (SHT31, BH1750, LCD 1602)
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22

// Cảm biến độ ẩm đất (Analog ADC1)
#define SOIL_ANALOG_PIN 34

// Rơ-le điều khiển thiết bị
#define RELAY_PUMP_PIN 26   // Máy bơm nước
#define RELAY_LIGHT_PIN 27  // Đèn quang hợp

// Còi báo động Buzzer mini
#define BUZZER_PIN 25

// Rơ-le thường kích hoạt ở mức LOW (Active LOW). Nếu dùng loại Active HIGH, đổi thành HIGH / LOW ngược lại
#define RELAY_ON  LOW
#define RELAY_OFF HIGH

// ==========================================
// 3. KHỞI TẠO ĐỐI TƯỢNG VÀ BIẾN TOÀN CỤC
// ==========================================
WebServer server(80);
WiFiClientSecure espClient;
PubSubClient mqttClient(espClient);
unsigned long lastMqttRetry = 0;
unsigned long lastTelemetryPublish = 0;
const unsigned long TELEMETRY_INTERVAL = 4000; // Gửi dữ liệu cảm biến lên HiveMQ Cloud mỗi 4 giây

Adafruit_SHT31 sht31 = Adafruit_SHT31();
BH1750 lightMeter;
LiquidCrystal_I2C lcd(0x27, 16, 2); // Địa chỉ I2C mặc định LCD 1602 thường là 0x27 (hoặc 0x3F)

bool hasSHT31 = false;
bool hasBH1750 = false;
bool hasLCD = false;

// Trạng thái thiết bị
bool isPumpOn = false;
bool isLightOn = false;
unsigned long pumpLastToggleTime = 0;
unsigned long lightLastToggleTime = 0;
String pumpLastToggledIso = "2026-09-30T00:00:00Z";
String lightLastToggledIso = "2026-09-30T00:00:00Z";

// Hiệu chuẩn cảm biến độ ẩm đất (Khô trong không khí = 3200, Ngập trong nước = 1200)
int rawSoilDry = 3200;
int rawSoilWet = 1200;

// Non-blocking Buzzer
unsigned long buzzerOffTime = 0;
bool isBuzzerActive = false;

void beep(int ms = 60) {
  digitalWrite(BUZZER_PIN, HIGH);
  buzzerOffTime = millis() + ms;
  isBuzzerActive = true;
}

void updateBuzzer() {
  if (isBuzzerActive && millis() >= buzzerOffTime) {
    digitalWrite(BUZZER_PIN, LOW);
    isBuzzerActive = false;
  }
}

// Bộ đệm lưu trữ dữ liệu thời gian thực
float curTemp = 28.0;
float curHumidity = 75.0;
float curSoilMoisture = 60.0;
float curLight = 12000.0;

// Lưu trữ lịch sử 12 điểm đo gần nhất (mỗi 10 phút lưu 1 điểm)
const int HISTORY_SIZE = 12;
float tempHistory[HISTORY_SIZE] = {26.5, 27.0, 27.2, 27.8, 28.5, 29.0, 29.2, 28.8, 28.4, 28.0, 27.9, 28.1};
float humidityHistory[HISTORY_SIZE] = {82, 80, 78, 76, 75, 74, 75, 76, 78, 79, 80, 78};
float soilHistory[HISTORY_SIZE] = {50, 52, 55, 58, 60, 62, 60, 59, 58, 56, 55, 54};
float lightHistory[HISTORY_SIZE] = {0, 500, 3500, 8000, 12500, 18000, 22000, 19000, 14000, 8500, 2000, 100};
int historyIndex = 0;
unsigned long lastHistoryRecordTime = 0;
const unsigned long HISTORY_INTERVAL = 10 * 60 * 1000; // 10 phút

// Hàm lấy thời gian định dạng ISO 8601 chuẩn
String getFormattedISOTime() {
  time_t now = time(nullptr);
  if (now > 1000000) {
    char buf[32];
    struct tm timeinfo;
    localtime_r(&now, &timeinfo);
    strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
    return String(buf);
  }
  unsigned long sec = millis() / 1000;
  int h = (sec / 3600) % 24;
  int m = (sec / 60) % 60;
  int s = sec % 60;
  char buf[32];
  snprintf(buf, sizeof(buf), "2026-09-30T%02d:%02d:%02dZ", h, m, s);
  return String(buf);
}

// ==========================================
// 4. HÀM TIỆN ÍCH CORS & JSON RESPONSE
// ==========================================
void sendCORSHeaders() {
  server.sendHeader("Access-Control-Allow-Origin", "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
}

void handleOptions() {
  sendCORSHeaders();
  server.send(204);
}

// ==========================================
// 5. ĐỌC DỮ LIỆU CẢM BIẾN
// ==========================================
void readSensors() {
  // 1. Đọc SHT31 (Nhiệt độ & Độ ẩm không khí)
  if (hasSHT31) {
    float t = sht31.readTemperature();
    float h = sht31.readHumidity();
    if (!isnan(t)) curTemp = t;
    if (!isnan(h)) curHumidity = h;
  }

  // 2. Đọc BH1750 (Cường độ ánh sáng)
  if (hasBH1750) {
    float l = lightMeter.readLightLevel();
    if (l >= 0) curLight = l;
  }

  // 3. Đọc Cảm biến độ ẩm đất (Sử dụng ngưỡng hiệu chuẩn tự động)
  int rawSoil = analogRead(SOIL_ANALOG_PIN);
  int mappedSoil = map(rawSoil, rawSoilDry, rawSoilWet, 0, 100);
  curSoilMoisture = constrain(mappedSoil, 0, 100);
}

// ==========================================
// 5.1. CÁC HÀM GIAO TIẾP CLOUD MQTT (HIVEMQ)
// ==========================================
void publishDeviceState(const char* devType, bool state, String isoTime) {
  if (!mqttClient.connected()) return;
  StaticJsonDocument<256> doc;
  doc["type"] = devType;
  doc["label"] = (strcmp(devType, "pump") == 0) ? "Máy bơm nước" : "Đèn quang hợp";
  doc["isOn"] = state;
  doc["lastToggledAt"] = isoTime;
  char buf[256];
  serializeJson(doc, buf);
  const char* topic = (strcmp(devType, "pump") == 0) ? TOPIC_STATE_PUMP : TOPIC_STATE_LIGHT;
  mqttClient.publish(topic, buf, true); // retained = true để App vừa mở lên là nhận ngay trạng thái
}

void publishSensorsTelemetry() {
  if (!mqttClient.connected()) return;
  readSensors();
  StaticJsonDocument<512> doc;
  doc["temperature"] = round(curTemp * 10.0) / 10.0;
  doc["airHumidity"] = round(curHumidity);
  doc["soilMoisture"] = round(curSoilMoisture);
  doc["light"] = round(curLight);
  doc["updatedAt"] = getFormattedISOTime();
  char buf[512];
  serializeJson(doc, buf);
  mqttClient.publish(TOPIC_SENSORS, buf);
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  char message[512];
  if (length >= sizeof(message)) return;
  memcpy(message, payload, length);
  message[length] = '\0';
  Serial.print("[MQTT Cloud] Nhận lệnh từ topic [");
  Serial.print(topic);
  Serial.print("]: ");
  Serial.println(message);

  StaticJsonDocument<256> doc;
  DeserializationError err = deserializeJson(doc, message);
  if (err) {
    Serial.println("[MQTT Cloud] Lỗi giải mã JSON lệnh");
    return;
  }

  bool newState = false;
  if (doc.containsKey("isOn")) {
    newState = doc["isOn"].as<bool>();
  }

  if (strcmp(topic, TOPIC_CONTROL_PUMP) == 0) {
    isPumpOn = newState;
    digitalWrite(RELAY_PUMP_PIN, isPumpOn ? RELAY_ON : RELAY_OFF);
    pumpLastToggleTime = millis();
    pumpLastToggledIso = getFormattedISOTime();
    Serial.print("[RELAY] Máy bơm chuyển trạng thái: ");
    Serial.println(isPumpOn ? "BẬT" : "TẮT");
    beep(60);
    publishDeviceState("pump", isPumpOn, pumpLastToggledIso);
  } else if (strcmp(topic, TOPIC_CONTROL_LIGHT) == 0) {
    isLightOn = newState;
    digitalWrite(RELAY_LIGHT_PIN, isLightOn ? RELAY_ON : RELAY_OFF);
    lightLastToggleTime = millis();
    lightLastToggledIso = getFormattedISOTime();
    Serial.print("[RELAY] Đèn quang hợp chuyển trạng thái: ");
    Serial.println(isLightOn ? "BẬT" : "TẮT");
    beep(60);
    publishDeviceState("growLight", isLightOn, lightLastToggledIso);
  }
}

void reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (mqttClient.connected()) return;

  unsigned long now = millis();
  if (now - lastMqttRetry < 5000) return; // Thử kết nối lại mỗi 5 giây mà không làm đơ hệ thống
  lastMqttRetry = now;

  Serial.print("[MQTT Cloud] Đang kết nối HiveMQ: ");
  Serial.println(MQTT_SERVER);

  String clientId = "ESP32_Farm_" + String(random(0xffff), HEX);

  if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
    Serial.println("[OK] Đã kết nối HiveMQ Cloud thành công!");
    mqttClient.subscribe(TOPIC_CONTROL_PUMP);
    mqttClient.subscribe(TOPIC_CONTROL_LIGHT);
    Serial.println("[OK] Đã subscribe topic điều khiển máy bơm và đèn.");

    // Gửi trạng thái hiện tại lên Cloud
    publishDeviceState("pump", isPumpOn, pumpLastToggledIso);
    publishDeviceState("growLight", isLightOn, lightLastToggledIso);
    publishSensorsTelemetry();
  } else {
    Serial.print("[LỖI] Kết nối HiveMQ thất bại, rc=");
    Serial.println(mqttClient.state());
  }
}

// ==========================================
// 6. CÁC API ENDPOINTS
// ==========================================

// GET /api/sensors -> Trả về danh sách cảm biến thời gian thực
void handleGetSensors() {
  readSensors();
  sendCORSHeaders();

  StaticJsonDocument<1024> doc;
  JsonArray arr = doc.to<JsonArray>();

  // Nhiệt độ
  JsonObject s1 = arr.createNestedObject();
  s1["type"] = "temperature";
  s1["value"] = round(curTemp * 10.0) / 10.0;
  s1["unit"] = "°C";
  s1["min"] = 0;
  s1["max"] = 50;
  s1["optimalMin"] = 22;
  s1["optimalMax"] = 32;
  s1["updatedAt"] = getFormattedISOTime();

  // Độ ẩm không khí
  JsonObject s2 = arr.createNestedObject();
  s2["type"] = "airHumidity";
  s2["value"] = round(curHumidity);
  s2["unit"] = "%";
  s2["min"] = 0;
  s2["max"] = 100;
  s2["optimalMin"] = 60;
  s2["optimalMax"] = 80;
  s2["updatedAt"] = getFormattedISOTime();

  // Độ ẩm đất
  JsonObject s3 = arr.createNestedObject();
  s3["type"] = "soilMoisture";
  s3["value"] = round(curSoilMoisture);
  s3["unit"] = "%";
  s3["min"] = 0;
  s3["max"] = 100;
  s3["optimalMin"] = 45;
  s3["optimalMax"] = 70;
  s3["updatedAt"] = getFormattedISOTime();

  // Cường độ ánh sáng
  JsonObject s4 = arr.createNestedObject();
  s4["type"] = "light";
  s4["value"] = round(curLight);
  s4["unit"] = "lx";
  s4["min"] = 0;
  s4["max"] = 65535;
  s4["optimalMin"] = 10000;
  s4["optimalMax"] = 25000;
  s4["updatedAt"] = getFormattedISOTime();

  String output;
  serializeJson(doc, output);
  server.send(200, "application/json", output);
}

// GET /api/devices -> Lấy danh sách thiết bị
void handleGetDevices() {
  sendCORSHeaders();

  StaticJsonDocument<512> doc;
  JsonArray arr = doc.to<JsonArray>();

  JsonObject d1 = arr.createNestedObject();
  d1["type"] = "pump";
  d1["label"] = "Máy bơm nước";
  d1["isOn"] = isPumpOn;
  d1["lastToggledAt"] = pumpLastToggledIso;

  JsonObject d2 = arr.createNestedObject();
  d2["type"] = "growLight";
  d2["label"] = "Đèn quang hợp";
  d2["isOn"] = isLightOn;
  d2["lastToggledAt"] = lightLastToggledIso;

  String output;
  serializeJson(doc, output);
  server.send(200, "application/json", output);
}

// POST /api/devices/{type} -> Điều khiển bật/tắt rơ-le
void handleToggleDevice() {
  sendCORSHeaders();
  String uri = server.uri();
  
  if (server.method() == HTTP_OPTIONS) {
    server.send(204);
    return;
  }

  String requestBody = server.arg("plain");
  StaticJsonDocument<256> reqDoc;
  DeserializationError err = deserializeJson(reqDoc, requestBody);

  bool newState = false;
  if (!err && reqDoc.containsKey("isOn")) {
    newState = reqDoc["isOn"].as<bool>();
  }

  StaticJsonDocument<256> resDoc;

  if (uri.indexOf("pump") >= 0) {
    isPumpOn = newState;
    digitalWrite(RELAY_PUMP_PIN, isPumpOn ? RELAY_ON : RELAY_OFF);
    pumpLastToggleTime = millis();
    pumpLastToggledIso = getFormattedISOTime();
    beep(60);
    publishDeviceState("pump", isPumpOn, pumpLastToggledIso);

    resDoc["type"] = "pump";
    resDoc["label"] = "Máy bơm nước";
    resDoc["isOn"] = isPumpOn;
    resDoc["lastToggledAt"] = pumpLastToggledIso;
  } else if (uri.indexOf("growLight") >= 0) {
    isLightOn = newState;
    digitalWrite(RELAY_LIGHT_PIN, isLightOn ? RELAY_ON : RELAY_OFF);
    lightLastToggleTime = millis();
    lightLastToggledIso = getFormattedISOTime();
    beep(60);
    publishDeviceState("growLight", isLightOn, lightLastToggledIso);

    resDoc["type"] = "growLight";
    resDoc["label"] = "Đèn quang hợp";
    resDoc["isOn"] = isLightOn;
    resDoc["lastToggledAt"] = lightLastToggledIso;
  } else {
    server.send(404, "application/json", "{\"error\":\"Thiết bị không tồn tại\"}");
    return;
  }

  String resStr;
  serializeJson(resDoc, resStr);
  server.send(200, "application/json", resStr);
}


// GET /api/sensors/{type}/history -> Lịch sử đo
void handleGetHistory() {
  sendCORSHeaders();
  String uri = server.uri();

  int requestedHours = 12;
  if (server.hasArg("hours")) {
    int h = server.arg("hours").toInt();
    if (h > 0 && h <= 24) requestedHours = h;
  }

  StaticJsonDocument<2048> doc;
  JsonArray arr = doc.to<JsonArray>();

  int points = min(requestedHours, HISTORY_SIZE);
  int stepHours = max(1, requestedHours / points);

  for (int i = 0; i < points; i++) {
    int idx = (historyIndex + i) % HISTORY_SIZE;
    JsonObject pt = arr.createNestedObject();
    pt["time"] = String(i * stepHours) + ":00";

    if (uri.indexOf("temperature") >= 0) {
      pt["value"] = tempHistory[idx];
    } else if (uri.indexOf("airHumidity") >= 0) {
      pt["value"] = humidityHistory[idx];
    } else if (uri.indexOf("soilMoisture") >= 0) {
      pt["value"] = soilHistory[idx];
    } else {
      pt["value"] = lightHistory[idx];
    }
  }

  String output;
  serializeJson(doc, output);
  server.send(200, "application/json", output);
}

// GET/POST /api/sensors/soil/calibration -> Lấy hoặc cập nhật thông số hiệu chuẩn độ ẩm đất
void handleSoilCalibration() {
  sendCORSHeaders();
  if (server.method() == HTTP_OPTIONS) {
    server.send(204);
    return;
  }

  if (server.method() == HTTP_GET) {
    StaticJsonDocument<256> doc;
    doc["dry"] = rawSoilDry;
    doc["wet"] = rawSoilWet;
    doc["currentRaw"] = analogRead(SOIL_ANALOG_PIN);
    doc["currentPercent"] = curSoilMoisture;
    String s;
    serializeJson(doc, s);
    server.send(200, "application/json", s);
    return;
  }

  if (server.method() == HTTP_POST) {
    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, server.arg("plain"));
    if (!err) {
      if (doc.containsKey("dry")) rawSoilDry = doc["dry"].as<int>();
      if (doc.containsKey("wet")) rawSoilWet = doc["wet"].as<int>();
    }
    server.send(200, "application/json", "{\"status\":\"success\"}");
  }
}

// GET /api/ai/insights -> Edge AI Chẩn đoán cục bộ trên ESP32
void handleGetInsights() {
  readSensors();
  sendCORSHeaders();

  StaticJsonDocument<1536> doc;
  JsonArray arr = doc.to<JsonArray>();

  // 1. Phân tích độ ẩm không khí & nấm bệnh
  if (curHumidity > 80.0) {
    JsonObject i1 = arr.createNestedObject();
    i1["id"] = "1";
    i1["level"] = "danger";
    i1["title"] = "Nguy cơ nấm lá cao";
    i1["description"] = "Độ ẩm không khí đang ở mức cao (" + String(curHumidity, 0) + "%), môi trường thuận lợi cho nấm bệnh phát triển.";
    i1["confidence"] = 88;
    i1["recommendation"] = "Bật quạt thông gió và hạn chế tưới nước lúc này.";
    i1["createdAt"] = "Vừa xong";
  }

  // 2. Phân tích độ ẩm đất
  if (curSoilMoisture < 45.0) {
    JsonObject i2 = arr.createNestedObject();
    i2["id"] = "2";
    i2["level"] = "warning";
    i2["title"] = "Độ ẩm đất thấp";
    i2["description"] = "Đất đang bị khô (" + String(curSoilMoisture, 0) + "%), thấp hơn ngưỡng khuyến nghị (45-70%).";
    i2["confidence"] = 85;
    i2["recommendation"] = "Kích hoạt máy bơm nước từ 10 - 15 phút.";
    i2["createdAt"] = "Vừa xong";
  } else if (curSoilMoisture > 75.0) {
    JsonObject i2 = arr.createNestedObject();
    i2["id"] = "2";
    i2["level"] = "warning";
    i2["title"] = "Đất bị ngập úng nhẹ";
    i2["description"] = "Độ ẩm đất vượt mức (" + String(curSoilMoisture, 0) + "%), có nguy cơ úng rễ.";
    i2["confidence"] = 80;
    i2["recommendation"] = "Ngừng tưới nước và kiểm tra rãnh thoát nước.";
    i2["createdAt"] = "Vừa xong";
  } else {
    JsonObject i2 = arr.createNestedObject();
    i2["id"] = "2";
    i2["level"] = "success";
    i2["title"] = "Độ ẩm đất lý tưởng";
    i2["description"] = "Độ ẩm đất đạt " + String(curSoilMoisture, 0) + "%, rất phù hợp cho sự sinh trưởng của cây trồng.";
    i2["confidence"] = 92;
    i2["recommendation"] = "Duy trì chế độ tưới tiêu định kỳ hiện tại.";
    i2["createdAt"] = "Vừa xong";
  }

  // 3. Phân tích cường độ ánh sáng
  if (curLight < 5000.0) {
    JsonObject i3 = arr.createNestedObject();
    i3["id"] = "3";
    i3["level"] = "info";
    i3["title"] = "Thiếu hụt ánh sáng";
    i3["description"] = "Cường độ ánh sáng (" + String(curLight, 0) + " lx) thấp hơn mức quang hợp tốt nhất.";
    i3["confidence"] = 78;
    i3["recommendation"] = "Bật đèn quang hợp bổ sung năng lượng cho cây.";
    i3["createdAt"] = "Vừa xong";
  } else {
    JsonObject i3 = arr.createNestedObject();
    i3["id"] = "3";
    i3["level"] = "success";
    i3["title"] = "Ánh sáng đầy đủ";
    i3["description"] = "Cường độ quang hợp đạt " + String(curLight, 0) + " lx, cây trồng hấp thụ tốt.";
    i3["confidence"] = 95;
    i3["recommendation"] = "Không cần sử dụng đèn nhân tạo.";
    i3["createdAt"] = "Vừa xong";
  }

  String output;
  serializeJson(doc, output);
  server.send(200, "application/json", output);
}

// ==========================================
// 7. SETUP & LOOP
// ==========================================
void updateLCD() {
  if (!hasLCD) return;
  static unsigned long lastLcdUpdate = 0;
  static int screenPage = 0;
  if (millis() - lastLcdUpdate < 2500) return;
  lastLcdUpdate = millis();

  lcd.clear();
  if (screenPage == 0) {
    // Trang 1: Thông số môi trường thời gian thực
    lcd.setCursor(0, 0);
    lcd.print("T:" + String(curTemp, 1) + "C H:" + String(curHumidity, 0) + "%");
    lcd.setCursor(0, 1);
    lcd.print("Dat:" + String(curSoilMoisture, 0) + "% L:" + String((int)curLight) + "lx");
    screenPage = 1;
  } else {
    // Trang 2: Trạng thái bơm, đèn, chế độ Cloud [C]/Local [L] & Địa chỉ IP Web Server
    lcd.setCursor(0, 0);
    String cloudTag = mqttClient.connected() ? " [C]" : " [L]";
    lcd.print("B:" + String(isPumpOn ? "ON " : "OFF ") + "D:" + String(isLightOn ? "ON" : "OFF") + cloudTag);
    lcd.setCursor(0, 1);
    lcd.print(WiFi.localIP().toString());
    screenPage = 0;
  }
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- HỆ THỐNG AIoT NÔNG NGHIỆP THÔNG MINH ---");

  // Khởi tạo chân Relay & Buzzer
  pinMode(RELAY_PUMP_PIN, OUTPUT);
  pinMode(RELAY_LIGHT_PIN, OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(RELAY_PUMP_PIN, RELAY_OFF);
  digitalWrite(RELAY_LIGHT_PIN, RELAY_OFF);
  digitalWrite(BUZZER_PIN, LOW);

  // Khởi tạo I2C chung (GPIO 21 SDA, GPIO 22 SCL)
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

  // Khởi tạo LCD 1602 qua I2C
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("AIoT Smart Farm");
  lcd.setCursor(0, 1);
  lcd.print("Connecting WiFi");
  hasLCD = true;

  // Khởi tạo SHT31
  if (sht31.begin(0x44)) {
    hasSHT31 = true;
    Serial.println("[OK] Đã tìm thấy cảm biến nhiệt ẩm SHT31 (0x44)");
  } else {
    Serial.println("[CẢNH BÁO] Không tìm thấy SHT31, chuyển sang chế độ mô phỏng.");
  }

  // Khởi tạo BH1750
  if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    hasBH1750 = true;
    Serial.println("[OK] Đã tìm thấy cảm biến ánh sáng BH1750");
  } else {
    Serial.println("[CẢNH BÁO] Không tìm thấy BH1750, chuyển sang chế độ mô phỏng.");
  }

  // Kết nối Wi-Fi
  Serial.print("Đang kết nối tới Wi-Fi: ");
  Serial.println(WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[OK] Kết nối Wi-Fi thành công!");
    Serial.print(">> ĐỊA CHỈ IP ESP32 CỦA BẠN: ");
    Serial.println(WiFi.localIP());
    Serial.println(">> Hãy nhập địa chỉ này vào services/api.ts trên React Native App!");

    if (hasLCD) {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("WiFi Connected!");
      lcd.setCursor(0, 1);
      lcd.print(WiFi.localIP().toString());
    }

    // Đồng bộ thời gian thực qua NTP (Múi giờ Việt Nam UTC+7)
    configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");
    pumpLastToggledIso = getFormattedISOTime();
    lightLastToggledIso = getFormattedISOTime();

    // Bíp 1 tiếng thông báo hệ thống đã sẵn sàng
    beep(100);
  } else {
    Serial.println("\n[LỖI] Không thể kết nối Wi-Fi. ESP32 sẽ phát Access Point dự phòng...");
    WiFi.softAP("ESP32_AIoT_Farm", "12345678");
    Serial.print(">> IP Access Point: ");
    Serial.println(WiFi.softAPIP());

    if (hasLCD) {
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("AP: ESP32_Farm");
      lcd.setCursor(0, 1);
      lcd.print(WiFi.softAPIP().toString());
    }
  }

  // Đăng ký REST API Routes
  server.on("/api/sensors", HTTP_GET, handleGetSensors);
  server.on("/api/sensors", HTTP_OPTIONS, handleOptions);

  server.on("/api/sensors/soil/calibration", HTTP_GET, handleSoilCalibration);
  server.on("/api/sensors/soil/calibration", HTTP_POST, handleSoilCalibration);
  server.on("/api/sensors/soil/calibration", HTTP_OPTIONS, handleOptions);

  server.on("/api/devices", HTTP_GET, handleGetDevices);
  server.on("/api/devices", HTTP_OPTIONS, handleOptions);

  server.on("/api/devices/pump", HTTP_POST, handleToggleDevice);
  server.on("/api/devices/pump", HTTP_OPTIONS, handleOptions);

  server.on("/api/devices/growLight", HTTP_POST, handleToggleDevice);
  server.on("/api/devices/growLight", HTTP_OPTIONS, handleOptions);

  server.on("/api/ai/insights", HTTP_GET, handleGetInsights);
  server.on("/api/ai/insights", HTTP_OPTIONS, handleOptions);

  // Wildcard handler cho history
  server.onNotFound([]() {
    String uri = server.uri();
    if (server.method() == HTTP_OPTIONS) {
      handleOptions();
    } else if (uri.indexOf("/history") >= 0) {
      handleGetHistory();
    } else {
      sendCORSHeaders();
      server.send(404, "application/json", "{\"error\":\"Route not found\"}");
    }
  });

  // Khởi tạo MQTT Client với TLS bảo mật
  espClient.setInsecure(); // Sử dụng kết nối bảo mật tới HiveMQ Cloud không cần nạp chứng chỉ gốc nặng nề
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(1024);

  if (WiFi.status() == WL_CONNECTED) {
    reconnectMQTT();
  }

  server.begin();
  Serial.println("[OK] HTTP REST API Server đã sẵn sàng phục vụ App!");
}

void loop() {
  server.handleClient();

  // Duy trì kết nối MQTT và xử lý các gói tin điều khiển từ Cloud
  if (WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      reconnectMQTT();
    } else {
      mqttClient.loop();
    }
  }

  // Đọc cảm biến liên tục
  readSensors();

  // Gửi telemetry lên HiveMQ Cloud định kỳ mỗi 4 giây
  if (millis() - lastTelemetryPublish >= TELEMETRY_INTERVAL) {
    lastTelemetryPublish = millis();
    publishSensorsTelemetry();
  }

  // Cập nhật trạng thái Buzzer non-blocking
  updateBuzzer();

  // Cập nhật màn hình LCD luân phiên 2.5s
  updateLCD();

  // Định kỳ 10 phút cập nhật mảng lịch sử một lần
  if (millis() - lastHistoryRecordTime > HISTORY_INTERVAL) {
    lastHistoryRecordTime = millis();

    tempHistory[historyIndex] = curTemp;
    humidityHistory[historyIndex] = curHumidity;
    soilHistory[historyIndex] = curSoilMoisture;
    lightHistory[historyIndex] = curLight;

    historyIndex = (historyIndex + 1) % HISTORY_SIZE;
  }
}
