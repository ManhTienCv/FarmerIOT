/*
 * =========================================================================================
 * DỰ ÁN: NÔNG NGHIỆP THÔNG MINH AIoT (SMART AGRICULTURE)
 * PHẦN CỨNG: ESP32 + SHT31 + BH1750 + CẢM BIẾN ĐỘ ẨM ĐẤT + RELAY 2 KÊNH
 * GIAO THỨC: REST API HTTP SERVER (Tương thích 100% với Expo/React Native App)
 * =========================================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_SHT31.h>
#include <BH1750.h>

// ==========================================
// 1. CẤU HÌNH WI-FI (THAY ĐỔI THEO MẠNG CỦA BẠN)
// ==========================================
const char* WIFI_SSID = "YOUR_WIFI_NAME";        // Tên Wi-Fi nhà bạn
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"; // Mật khẩu Wi-Fi

// ==========================================
// 2. CẤU HÌNH CHÂN PHẦN CỨNG (PINOUT)
// ==========================================
// I2C (SHT31 & BH1750)
#define I2C_SDA_PIN 21
#define I2C_SCL_PIN 22

// Cảm biến độ ẩm đất (Analog ADC1)
#define SOIL_ANALOG_PIN 34

// Rơ-le điều khiển thiết bị
#define RELAY_PUMP_PIN 26   // Máy bơm nước
#define RELAY_LIGHT_PIN 27  // Đèn quang hợp

// Rơ-le thường kích hoạt ở mức LOW (Active LOW). Nếu dùng loại Active HIGH, đổi thành HIGH / LOW ngược lại
#define RELAY_ON  LOW
#define RELAY_OFF HIGH

// ==========================================
// 3. KHỞI TẠO ĐỐI TƯỢNG VÀ BIẾN TOÀN CỤC
// ==========================================
WebServer server(80);
Adafruit_SHT31 sht31 = Adafruit_SHT31();
BH1750 lightMeter;

bool hasSHT31 = false;
bool hasBH1750 = false;

// Trạng thái thiết bị
bool isPumpOn = false;
bool isLightOn = false;
unsigned long pumpLastToggleTime = 0;
unsigned long lightLastToggleTime = 0;

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

  // 3. Đọc Cảm biến độ ẩm đất (0 - 4095 ADC -> 0 - 100%)
  // Cảm biến điện dung hoặc điện trở: trong không khí khô ADC ~ 3200-3500, ngập nước ~ 1200-1500
  int rawSoil = analogRead(SOIL_ANALOG_PIN);
  int mappedSoil = map(rawSoil, 3200, 1200, 0, 100);
  curSoilMoisture = constrain(mappedSoil, 0, 100);
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
  s1["updatedAt"] = "vừa xong";

  // Độ ẩm không khí
  JsonObject s2 = arr.createNestedObject();
  s2["type"] = "airHumidity";
  s2["value"] = round(curHumidity);
  s2["unit"] = "%";
  s2["min"] = 0;
  s2["max"] = 100;
  s2["optimalMin"] = 60;
  s2["optimalMax"] = 80;
  s2["updatedAt"] = "vừa xong";

  // Độ ẩm đất
  JsonObject s3 = arr.createNestedObject();
  s3["type"] = "soilMoisture";
  s3["value"] = round(curSoilMoisture);
  s3["unit"] = "%";
  s3["min"] = 0;
  s3["max"] = 100;
  s3["optimalMin"] = 45;
  s3["optimalMax"] = 70;
  s3["updatedAt"] = "vừa xong";

  // Cường độ ánh sáng
  JsonObject s4 = arr.createNestedObject();
  s4["type"] = "light";
  s4["value"] = round(curLight);
  s4["unit"] = "lx";
  s4["min"] = 0;
  s4["max"] = 65535;
  s4["optimalMin"] = 10000;
  s4["optimalMax"] = 25000;
  s4["updatedAt"] = "vừa xong";

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
  d1["lastToggledAt"] = "Hôm nay";

  JsonObject d2 = arr.createNestedObject();
  d2["type"] = "growLight";
  d2["label"] = "Đèn quang hợp";
  d2["isOn"] = isLightOn;
  d2["lastToggledAt"] = "Hôm nay";

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

    resDoc["type"] = "pump";
    resDoc["label"] = "Máy bơm nước";
    resDoc["isOn"] = isPumpOn;
    resDoc["lastToggledAt"] = "Vừa xong";
  } else if (uri.indexOf("growLight") >= 0) {
    isLightOn = newState;
    digitalWrite(RELAY_LIGHT_PIN, isLightOn ? RELAY_ON : RELAY_OFF);
    lightLastToggleTime = millis();

    resDoc["type"] = "growLight";
    resDoc["label"] = "Đèn quang hợp";
    resDoc["isOn"] = isLightOn;
    resDoc["lastToggledAt"] = "Vừa xong";
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

  StaticJsonDocument<1024> doc;
  JsonArray arr = doc.to<JsonArray>();

  for (int i = 0; i < HISTORY_SIZE; i++) {
    int idx = (historyIndex + i) % HISTORY_SIZE;
    JsonObject pt = arr.createNestedObject();
    pt["time"] = String(i * 2) + ":00";

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
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- HỆ THỐNG AIoT NÔNG NGHIỆP THÔNG MINH ---");

  // Khởi tạo chân Relay
  pinMode(RELAY_PUMP_PIN, OUTPUT);
  pinMode(RELAY_LIGHT_PIN, OUTPUT);
  digitalWrite(RELAY_PUMP_PIN, RELAY_OFF);
  digitalWrite(RELAY_LIGHT_PIN, RELAY_OFF);

  // Khởi tạo I2C
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

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
  } else {
    Serial.println("\n[LỖI] Không thể kết nối Wi-Fi. ESP32 sẽ phát Access Point dự phòng...");
    WiFi.softAP("ESP32_AIoT_Farm", "12345678");
    Serial.print(">> IP Access Point: ");
    Serial.println(WiFi.softAPIP());
  }

  // Đăng ký REST API Routes
  server.on("/api/sensors", HTTP_GET, handleGetSensors);
  server.on("/api/sensors", HTTP_OPTIONS, handleOptions);

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

  server.begin();
  Serial.println("[OK] HTTP REST API Server đã sẵn sàng phục vụ App!");
}

void loop() {
  server.handleClient();

  // Định kỳ 10 phút cập nhật mảng lịch sử một lần
  if (millis() - lastHistoryRecordTime > HISTORY_INTERVAL) {
    lastHistoryRecordTime = millis();
    readSensors();

    tempHistory[historyIndex] = curTemp;
    humidityHistory[historyIndex] = curHumidity;
    soilHistory[historyIndex] = curSoilMoisture;
    lightHistory[historyIndex] = curLight;

    historyIndex = (historyIndex + 1) % HISTORY_SIZE;
  }
}
