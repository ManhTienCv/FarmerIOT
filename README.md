# Ứng Dụng Quản Lý Nông Nghiệp Thông Minh AIoT

Ứng dụng di động và web đa nền tảng (**Expo SDK 57** / React Native) phong cách Bắc Âu (Scandinavian Sage & Linen) tích hợp thanh điều hướng nổi dạng viên thuốc (Meta Threads Style), giám sát thông số môi trường, điều khiển thiết bị rơ-le từ xa và đưa ra chẩn đoán thông minh về sức khỏe cây trồng.

---

## 📚 Tài Liệu Hướng Dẫn Kèm Theo

1. 👉 [**HUONG_DAN_EXPO_GO_VA_GIAO_DIEN.md**](file:///d:/WebsiteAppFullProject/IOT/HUONG_DAN_EXPO_GO_VA_GIAO_DIEN.md): Hướng dẫn kết nối Expo Go trên iPhone/Android, đăng nhập Token GitHub SSO, chạy chế độ Tunnel và chi tiết các nâng cấp giao diện.
2. 👉 [**HUONG_DAN_SU_DUNG.md**](file:///d:/WebsiteAppFullProject/IOT/HUONG_DAN_SU_DUNG.md): Hướng dẫn toàn diện từ A-Z về sơ đồ nối dây phần cứng (Wiring Pinout), nạp code Arduino cho ESP32, cấu hình IP mạng và xử lý sự cố.

---

## 🌟 Tính Năng Chính

1. **Giám Sát Thời Gian Thực (Dashboard)**:
   - Hiển thị thông số 4 cảm biến: Nhiệt độ (°C), Độ ẩm không khí (%), Độ ẩm đất (%), Cường độ ánh sáng (lx).
   - Biểu đồ biến thiên dạng sóng SVG trong 12 giờ gần nhất.
   - Hệ thống cảnh báo trực quan khi giá trị cảm biến vượt ngưỡng an toàn.

2. **Bảng Điều Khiển Thiết Bị (Control)**:
   - Bật/tắt các thiết bị ngoại vi (Máy bơm nước, Đèn quang hợp) với phản hồi chuyển động mượt mà (Reanimated).
   - Nhật ký ghi nhận thời gian đóng/ngắt mạch rơ-le gần nhất.

3. **Chẩn Đoán Thông Minh (Smart Diagnosis)**:
   - Hệ luật chuyên gia nông học phát hiện rủi ro nấm bệnh, tình trạng thiếu nước hoặc thừa/thiếu ánh sáng.
   - Đánh giá độ tin cậy và đề xuất hành động xử lý kịp thời.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy

### 1. Cài đặt thư viện:
```bash
npm install
```

### 2. Khởi chạy ứng dụng:
- **Chạy trên Web**:
  ```bash
  npm run web
  ```
- **Chạy trên Expo Go / Mobile (Android / iOS) qua Tunnel (Khuyên dùng - Chấp cả 4G/5G/Hotspot)**:
  - **Cách 1-Click trên Windows:** Click đúp file [`chay_tunnel.bat`](file:///d:/WebsiteAppFullProject/IOT/chay_tunnel.bat)
  - **Hoặc chạy bằng npm:**
    ```bash
    npm run start:tunnel
    ```
  - **Nếu dùng Command Prompt (CMD):**
    ```cmd
    set EXPO_TOKEN=<YOUR_EXPO_TOKEN> && npx expo start --tunnel
    ```
  - **Nếu dùng PowerShell:**
    ```powershell
    $env:EXPO_TOKEN="<YOUR_EXPO_TOKEN>"; npx expo start --tunnel
    ```

---

## 🔌 Cấu Hình Kết Nối Phần Cứng (ESP32 / Backend)

Mở file [`services/api.ts`](file:///d:/WebsiteAppFullProject/IOT/services/api.ts) để cấu hình:
- **`USE_MOCK = true`**: Sử dụng dữ liệu giả lập (dùng cho phát triển giao diện).
- **`USE_MOCK = false`**: Kết nối tới ESP32 thật qua địa chỉ IP LAN nội bộ.


