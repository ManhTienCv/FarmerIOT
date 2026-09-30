# Ứng Dụng Quản Lý Nông Nghiệp Thông Minh AIoT

Ứng dụng di động và web đa nền tảng (**Expo SDK 57** / React Native) phong cách Bắc Âu (Scandinavian Sage & Linen) tích hợp thanh điều hướng nổi dạng viên thuốc (Meta Threads Style), giám sát thông số môi trường, điều khiển thiết bị rơ-le từ xa và đưa ra chẩn đoán thông minh về sức khỏe cây trồng.

---

## 📚 Tài Liệu Hướng Dẫn Kèm Theo (Thư mục docs/)

1. 👉 [**HUONG_DAN_DAU_NOI_PHAN_CUNG_A_TO_Z.md**](file:///d:/WebsiteAppFullProject/IOT/docs/HUONG_DAN_DAU_NOI_PHAN_CUNG_A_TO_Z.md): Sơ đồ đấu nối dây cảm biến DHT22, độ ẩm đất, ánh sáng BH1750, rơ-le và nạp code ESP32.
2. 👉 [**HUONG_DAN_EXPO_GO_VA_GIAO_DIEN.md**](file:///d:/WebsiteAppFullProject/IOT/docs/HUONG_DAN_EXPO_GO_VA_GIAO_DIEN.md): Hướng dẫn kết nối Expo Go trên iPhone/Android, chạy Tunnel và chi tiết giao diện.
3. 👉 [**HUONG_DAN_SU_DUNG.md**](file:///d:/WebsiteAppFullProject/IOT/docs/HUONG_DAN_SU_DUNG.md): Hướng dẫn toàn diện vận hành hệ thống nông nghiệp thông minh.

---

## 🌟 Kiến Trúc Đám Mây & Phần Cứng 24/7

- **Phần cứng**: ESP32 gửi dữ liệu cảm biến & nhận lệnh qua MQTT (HiveMQ Cloud).
- **Backend (Render / Local)**: Chạy [`server.js`](file:///d:/WebsiteAppFullProject/IOT/server.js) hứng MQTT 24/7 và đồng bộ vào PostgreSQL.
- **Database (Supabase / pgAdmin)**: PostgreSQL lưu trữ `sensor_telemetry`, `device_events` và `crop_journals`.
- **Frontend (Vercel / Expo)**: Web & Mobile app hiển thị dữ liệu thực tế 100%, đồ thị lịch sử và chẩn đoán AI.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy

### 1. Cài đặt thư viện:
```bash
npm install
```

### 2. Chạy Máy chủ Cầu nối (Backend):
```bash
# Chạy Backend (tự động kết nối Supabase Cloud & PostgreSQL cục bộ):
npm run server
```

### 3. Chạy Ứng dụng Frontend:
- **Chạy trên Web**:
  ```bash
  npm run web
  ```
- **Chạy trên Mobile qua Tunnel (Chấp cả 4G/5G/Wi-Fi)**:
  - Click đúp file [`chay_tunnel.bat`](file:///d:/WebsiteAppFullProject/IOT/chay_tunnel.bat) trên Windows.
  - Hoặc chạy: `npm run start:tunnel`


