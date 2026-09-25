# 📘 TÀI LIỆU HƯỚNG DẪN TOÀN DIỆN: HỆ THỐNG NÔNG NGHIỆP THÔNG MINH AIoT

> **Dành cho:** Tất cả các thành viên trong nhóm nghiên cứu & phát triển dự án.  
> **Nội dung:** Toàn bộ quy trình từ chuẩn bị phần cứng, nối dây, nạp code cho ESP32, cấu hình và sử dụng App trên Điện thoại / Máy tính, cho đến phân tích logic, bảo mật và xử lý sự cố.

---

## 📑 MỤC LỤC
1. [Kiến Trúc Tổng Thể Hệ Thống](#1-kiến-trúc-tổng-thể-hệ-thống)
2. [Sơ Đồ Kết Nối Phần Cứng (Wiring Pinout)](#2-sơ-đồ-kết-nối-phần-cứng-wiring-pinout)
3. [Hướng Dẫn Cài Đặt & Nạp Code Cho ESP32](#3-hướng-dẫn-cài-đặt--nạp-code-cho-esp32)
4. [Hướng Dẫn Cấu Hình & Chạy Ứng Dụng (App)](#4-hướng-dẫn-cấu-hình--chạy-ứng-dụng-app)
5. [Hướng Dẫn Sử Dụng Các Tính Năng Trên Giao Diện](#5-hướng-dẫn-sử-dụng-các-tính-năng-trên-giao-diện)
6. [Đánh Giá Logic, Tính Ổn Định & Bảo Mật](#6-đánh-giá-logic-tính-ổn-định--bảo-mật)
7. [Bảng Xử Lý Sự Cố Thường Gặp (Troubleshooting)](#7-bảng-xử-lý-sự-cố-thường-gặp-troubleshooting)

---

## 1. KIẾN TRÚC TỔNG THỂ HỆ THỐNG

Hệ thống hoạt động theo mô hình **AIoT Edge-to-App** khép kín:
```
  ┌─────────────────────────────────────────────────────────────┐
  │                    PHẦN CỨNG NGOẠI VI                       │
  │  [Cảm biến SHT31]   [Cảm biến BH1750]   [Cảm biến Độ ẩm đất]│
  └──────────────┬──────────────┬────────────────────┬──────────┘
                 │ (I2C)        │ (I2C)              │ (Analog ADC)
                 ▼              ▼                    ▼
  ┌─────────────────────────────────────────────────────────────┐
  │              ESP32 VI ĐIỀU KHIỂN TRUNG TÂM                   │
  │  - Đọc dữ liệu môi trường & tính toán Heuristic Edge AI     │
  │  - Khởi chạy Web Server HTTP REST API (Cổng 80)             │
  │  - Xuất tín hiệu điều khiển Rơ-le (Bơm / Đèn)               │
  └──────────────────────────────┬──────────────────────────────┘
                                 │
                     Sóng Wi-Fi Mạng LAN Nội Bộ
                                 │
                                 ▼
  ┌─────────────────────────────────────────────────────────────┐
  │         ỨNG DỤNG AIoT NÔNG NGHIỆP (React Native / Expo)     │
  │  - Dashboard: Hiển thị thời gian thực & biểu đồ 12h          │
  │  - Điều khiển: Nút bật/tắt thiết bị tức thì                  │
  │  - AI Chẩn đoán: Đánh giá rủi ro nấm bệnh, thiếu ẩm         │
  └─────────────────────────────────────────────────────────────┘
```

---

## 2. SƠ ĐỒ KẾT NỐI PHẦN CỨNG (WIRING PINOUT)

### Danh sách linh kiện cần chuẩn bị:
1. **1x Board ESP32** (NodeMCU 30 chân hoặc 38 chân).
2. **1x Cảm biến SHT31**: Đo nhiệt độ (°C) và độ ẩm không khí (%).
3. **1x Cảm biến BH1750**: Đo cường độ ánh sáng (Lux).
4. **1x Cảm biến độ ẩm đất** (Khuyên dùng loại điện dung **Capacitive Soil Moisture Sensor v1.2** để chống ăn mòn).
5. **1x Module Relay 2 kênh 5V** (có Opto cách ly) điều khiển Máy bơm và Đèn.
6. **1x Máy bơm mini 5V/12V** + **1x Đèn LED nông nghiệp / Đèn sưởi**.
7. **Dây cắm testboard (Jumper wires)** + Nguồn Adapter 5V 2A.

### Bảng đấu dây chi tiết (Pinout Mapping):

| Tên Module | Chân trên Module | Chân kết nối trên ESP32 | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Cảm biến SHT31** | **VCC** | `3V3` | Cấp nguồn 3.3V |
| | **GND** | `GND` | Nối mass chung |
| | **SDA** | `GPIO 21` | Đường truyền dữ liệu I2C |
| | **SCL** | `GPIO 22` | Xung nhịp I2C |
| **Cảm biến BH1750** | **VCC** | `3V3` | Cấp nguồn 3.3V |
| | **GND** | `GND` | Nối mass chung |
| | **SDA** | `GPIO 21` | Nối chung bus I2C với SHT31 |
| | **SCL** | `GPIO 22` | Nối chung bus I2C với SHT31 |
| | **ADDR** | `GND` | Địa chỉ mặc định `0x23` |
| **Cảm biến Độ ẩm đất** | **VCC** | `3V3` (hoặc `5V`) | Nguồn cấp |
| | **GND** | `GND` | Nối mass chung |
| | **AOUT** | `GPIO 34` | Đọc tín hiệu Analog (ADC1_CH6) |
| **Module Relay 2 Kênh** | **VCC** | `5V` (hoặc `VIN`) | Nguồn nuôi cuộn hút rơ-le |
| | **GND** | `GND` | Nối mass chung |
| | **IN1 (Máy bơm)** | `GPIO 26` | Kích mức LOW để đóng mạch bơm |
| | **IN2 (Đèn quang hợp)**| `GPIO 27` | Kích mức LOW để bật đèn |

> ⚠️ **LƯU Ý QUAN TRỌNG VỀ NGUỒN ĐIỆN:**  
> - Các cảm biến SHT31, BH1750 và ADC đất dùng nguồn logic **3.3V**.
> - Không cấp nguồn 5V vào chân GPIO của ESP32 để tránh làm cháy chip.
> - Máy bơm khi khởi động có thể gây sụt dòng; nên cấp nguồn riêng hoặc dùng củ sạc từ **5V 2A** trở lên.

---

## 3. HƯỚNG DẪN CÀI ĐẶT & NẠP CODE CHO ESP32

Mã nguồn hoàn chỉnh cho ESP32 đã được tạo sẵn tại file:  
👉 **`firmware/esp32_aiot_agriculture/esp32_aiot_agriculture.ino`**

### Bước 3.1: Cài đặt phần mềm Arduino IDE
1. Tải và cài đặt **Arduino IDE 2.x** tại: [arduino.cc/en/software](https://www.arduino.cc/en/software).
2. Cài đặt Driver kết nối máy tính với ESP32:
   - Nếu chip giao tiếp là CH340: Cài driver **CH341SER**.
   - Nếu chip giao tiếp là CP2102: Cài driver **Silicon Labs CP210x USB to UART**.

### Bước 3.2: Thêm gói Board ESP32 vào Arduino IDE
1. Mở Arduino IDE -> vào menu `File` -> `Preferences`.
2. Ở mục **Additional boards manager URLs**, dán link sau vào:
   ```text
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Vào menu `Tools` -> `Board` -> `Boards Manager...`, tìm kiếm **"esp32"** (bởi *Espressif Systems*) và bấm **Install**.

### Bước 3.3: Cài đặt các thư viện cần thiết
Vào menu `Tools` -> `Manage Libraries...` (hoặc phím tắt `Ctrl + Shift + I`), tìm và cài đặt 3 thư viện sau:
1. **ArduinoJson** (bởi *Benoit Blanchon*) - Khuyên dùng phiên bản **6.x** hoặc **7.x**.
2. **Adafruit SHT31 Library** (bởi *Adafruit*).
3. **BH1750** (bởi *Christopher Laws*).

### Bước 3.4: Cấu hình Wi-Fi và nạp code
1. Mở file `firmware/esp32_aiot_agriculture/esp32_aiot_agriculture.ino`.
2. Sửa thông tin Wi-Fi của bạn ở dòng 18–19:
   ```cpp
   const char* WIFI_SSID = "Tên_Wifi_Của_Bạn";
   const char* WIFI_PASSWORD = "Mật_Khẩu_Wifi";
   ```
3. Kết nối ESP32 với máy tính qua cáp Micro-USB.
4. Vào menu `Tools` -> `Board` -> Chọn **DOIT ESP32 DEVKIT V1** (hoặc *ESP32 Dev Module*).
5. Vào menu `Tools` -> `Port` -> Chọn cổng COM tương ứng (ví dụ: `COM3`, `COM4`,...).
6. Bấm nút **Upload** (Mũi tên tròn chỉ sang phải) để nạp code.
   *(Mẹo: Nếu Arduino IDE hiển thị dòng chữ `Connecting........____`, hãy bấm giữ nút **BOOT** trên bo mạch ESP32 khoảng 2 giây rồi thả ra).*

### Bước 3.5: Lấy địa chỉ IP của ESP32
1. Sau khi nạp xong, vào `Tools` -> `Serial Monitor` (đặt tốc độ baud là **`115200`**).
2. Bấm nút **EN / RST** trên ESP32 để khởi động lại.
3. Serial Monitor sẽ hiển thị thông báo:
   ```text
   [OK] Kết nối Wi-Fi thành công!
   >> ĐỊA CHỈ IP ESP32 CỦA BẠN: 192.168.1.105
   ```
👉 **Hãy ghi nhớ địa chỉ IP này** (Ví dụ: `192.168.1.105`) để cấu hình vào App ở bước 4.

---

## 4. HƯỚNG DẪN CẤU HÌNH & CHẠY ỨNG DỤNG (APP)

### Bước 4.1: Cài đặt thư viện dự án
Mở Terminal tại thư mục gốc của dự án (`IOT/`) và chạy lệnh:
```bash
npm install
```

### Bước 4.2: Cấu hình địa chỉ IP kết nối tới ESP32
Mở file **`services/api.ts`** và cập nhật:
```typescript
// 1. Đổi USE_MOCK thành false để chuyển từ dữ liệu giả lập sang kết nối thật
export let USE_MOCK = false;

// 2. Điền địa chỉ IP của ESP32 bạn vừa lấy ở Bước 3.5
export let BASE_URL = 'http://192.168.1.105/api';
```
> *(Nếu muốn chạy thử giao diện khi chưa có phần cứng ESP32, chỉ cần đặt lại `USE_MOCK = true`)*.

### Bước 4.3: Khởi chạy ứng dụng

#### Cách 1: Chạy trực tiếp trên trình duyệt Web (Khuyên dùng để test nhanh)
```bash
npm run web
```
Ứng dụng sẽ tự động mở tại địa chỉ `http://localhost:8081`.

#### Cách 2: Chạy trên điện thoại di động (Android / iOS) qua Expo Go
1. Tải ứng dụng **Expo Go** từ App Store (iOS) hoặc Google Play Store (Android).
2. Chạy lệnh:
   ```bash
   npm start
   ```
3. Mở ứng dụng Camera (trên iPhone) hoặc quét mã QR trong app Expo Go (trên Android) để mở ứng dụng.
4. ⚠️ **Chú ý:** Điện thoại và ESP32 bắt buộc phải kết nối vào **cùng một mạng Wi-Fi**.

---

## 5. HƯỚNG DẪN SỬ DỤNG CÁC TÍNH NĂNG TRÊN GIAO DIỆN

### 1. Tab "Dashboard" (Tổng quan môi trường)
- **4 Thẻ cảm biến thời gian thực:**
  - Nhiệt độ (°C), Độ ẩm không khí (%), Độ ẩm đất (%), Cường độ ánh sáng (lx).
  - Màu sắc trạng thái: **Xanh lá** (Tối ưu), **Vàng cam** (Thấp), **Đỏ** (Vượt ngưỡng cao).
- **Thanh đo khoảng an toàn:** Vạch xanh biểu thị vùng tối ưu của cây trồng, chấm tròn hiển thị giá trị hiện tại.
- **Biểu đồ động 12 giờ:** Bấm vào bất kỳ thẻ cảm biến nào để xem biểu đồ lịch sử tương ứng.
- **Cơ chế cập nhật:** Tự động làm mới mỗi 8 giây hoặc vuốt kéo từ trên xuống (Pull-to-refresh).

### 2. Tab "Điều khiển" (Bật/tắt thiết bị)
- **Công tắc Relay thông minh:**
  - Bấm vào thẻ **Máy bơm nước** hoặc **Đèn quang hợp** để bật/tắt tức thì.
  - Hiệu ứng chuyển động (Reanimated) trực quan: Nút chuyển sang màu xanh / vàng cùng thanh trạng thái.
  - Có tính năng bảo vệ: Khi đang gửi lệnh, nút sẽ hiển thị vòng tròn xoay `loading` để tránh gửi lệnh dồn dập gây treo rơ-le.
- **Nhật ký đóng/ngắt mạch:** Hiển thị thời gian và trạng thái gần nhất của từng thiết bị.

### 3. Tab "AI Chẩn đoán" (Sức khỏe nông trại)
- **Thẻ đánh giá tổng quan:** Tổng hợp tình trạng nông trại ("Hệ thống khỏe mạnh", "Cần theo dõi" hoặc "Cần can thiệp ngay").
- **Danh sách khuyến nghị chuyên sâu:**
  - Nhận diện nguy cơ nấm lá Anthracnose khi độ ẩm KK > 80% kéo dài.
  - Cảnh báo khô hạn hoặc ngập úng rễ từ độ ẩm đất.
  - Khuyến nghị bổ sung quang hợp nhân tạo khi thiếu sáng.
  - Tỷ lệ tin cậy của thuật toán (%) được hiển thị rõ ràng trên từng thẻ.

---

## 6. ĐÁNG GIÁ LOGIC, TÍNH ỔN ĐỊNH & BẢO MẬT

### 1. Về Mặt Logic Vận Hành
- **Non-blocking Request:** Mọi thao tác tải dữ liệu và điều khiển đều chạy bất đồng bộ (`async/await`), không làm đơ giao diện người dùng.
- **Safe Timeout Guard:** Lớp API được trang bị `AbortController` với thời gian chờ tối đa **5 giây**. Nếu ESP32 bị mất nguồn hoặc mất sóng, ứng dụng sẽ hủy request an toàn và hiển thị cảnh báo thay vì bị treo vô tận.
- **Auto Sync & Polling:** Cơ chế tự động cập nhật 8 giây đồng bộ trên cả nền tảng Web và Mobile.

### 2. Về Tính Ổn Định (Stability)
- **Xử lý ngắt kết nối thông minh:** Khi mất mạng, màn hình giữ nguyên dữ liệu đệm cũ và thông báo lỗi rõ ràng, tránh hiện tượng màn hình trắng (White screen of death).
- **Phần cứng cách ly:** Relay sử dụng chân kích mức LOW với nguồn cuộn hút riêng biệt, loại bỏ hiện tượng nhiễu điện áp ngược vào vi điều khiển.
- **Fallback Chế độ Mock:** Nếu phần cứng chưa sẵn sàng, hệ thống có thể chuyển đổi tức thì sang dữ liệu mô phỏng (`USE_MOCK = true`) phục vụ thuyết trình hoặc kiểm thử giao diện.

### 3. Về Mặt Bảo Mật (Security)
- **Phạm vi bảo mật hiện tại:**
  - ESP32 hoạt động trong mạng LAN nội bộ (Local Area Network). Chỉ những thiết bị kết nối cùng Wi-Fi mới có quyền gửi lệnh và đọc dữ liệu.
  - Đã tích hợp đầy đủ chuẩn **CORS Header** an toàn cho phép giao tiếp Web Client.
- **Khuyến nghị nâng cấp bảo mật khi triển khai thương mại / Internet:**
  - Thêm `X-API-Key` hoặc `Bearer Token` vào Header của mỗi request để xác thực danh tính người dùng.
  - Sử dụng giao thức **MQTT qua TLS (Port 8883)** hoặc **HTTPS** khi đưa hệ thống ra Internet bên ngoài thông qua Router Port Forwarding / Cloud Server.

---

## 7. BẢNG XỬ LÝ SỰ CỐ THƯỜNG GẶP (TROUBLESHOOTING)

| Hiện tượng lỗi | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| **1. Nạp code ESP32 báo lỗi `Failed to connect to ESP32`** | ESP32 chưa vào chế độ nạp (Bootloader) hoặc cáp USB chỉ là cáp sạc (không truyền data). | - Đổi cáp USB có chức năng truyền dữ liệu.<br>- Khi màn hình Arduino IDE hiện `Connecting...`, **bấm giữ nút BOOT** trên ESP32 trong 2 giây rồi thả ra. |
| **2. Serial Monitor hiển thị ký tự lạ (``)** | Sai tốc độ Baud rate trong Serial Monitor. | Chọn tốc độ Baud ở góc dưới bên phải Serial Monitor thành **`115200 baud`**. |
| **3. ESP32 không kết nối được Wi-Fi** | Sai tên/mật khẩu Wi-Fi hoặc Wi-Fi phát ở băng tần 5GHz. | - ESP32 chỉ hỗ trợ Wi-Fi **2.4GHz**, hãy kết nối vào mạng 2.4GHz.<br>- Kiểm tra lại chính xác `WIFI_SSID` và `WIFI_PASSWORD` trong code. |
| **4. App báo: "Hết thời gian chờ..." hoặc "Không thể kết nối tới ESP32"** | - Điện thoại và ESP32 khác mạng Wi-Fi.<br>- Sai địa chỉ IP trong `services/api.ts`. | - Đảm bảo điện thoại/máy tính và ESP32 cùng kết nối 1 Wi-Fi.<br>- Mở Serial Monitor xem lại IP của ESP32 và cập nhật vào `BASE_URL`. |
| **5. Khi bật máy bơm thì ESP32 bị reset/khởi động lại** | Động cơ máy bơm hút dòng lớn gây sụt áp nguồn 5V của ESP32. | - Không cấp nguồn động cơ trực tiếp từ chân 3.3V/5V của ESP32.<br>- Cấp nguồn ngoài riêng cho máy bơm hoặc dùng củ sạc nguồn **5V 2A** chất lượng tốt. |
| **6. Cảm biến SHT31 hoặc BH1750 báo giá trị 0 hoặc không nhận** | Lỏng dây I2C hoặc sai chân SDA/SCL. | - Kiểm tra lại: `SDA -> GPIO 21`, `SCL -> GPIO 22`.<br>- Kiểm tra nguồn cấp `3.3V` và `GND` đã tiếp xúc chắc chắn chưa. |

---

> 💡 **Mẹo làm việc nhóm:**  
> Nếu các thành viên chưa có mạch ESP32 sẵn bên cạnh, hãy bật `export let USE_MOCK = true;` trong file `services/api.ts` để thoải mái phát triển và thử nghiệm các tính năng giao diện một cách độc lập!
