# 📱 HƯỚNG DẪN KẾT NỐI EXPO GO & TỔNG HỢP NÂNG CẤP GIAO DIỆN

> **Dự án:** AIoT Nông Nghiệp Thông Minh (aiot-nongnghiep)  
> **Phiên bản Expo:** SDK 57 (Hỗ trợ mới nhất cho iOS & Android)  
> **Phong cách thiết kế:** Scandinavian Sage & Linen (Bắc Âu) + Floating Pill Navbar (Meta Threads Style)

---

## 📑 MỤC LỤC

1. [Tổng Hợp Các Thay Đổi & Nâng Cấp Giao Diện Mới](#1-tổng-hợp-các-thay-đổi--nâng-cấp-giao-diện-mới)
2. [Cơ Chế Phân Tích Dữ Liệu & Tính Năng Chẩn Đoán](#2-cơ-chế-phân-tích-dữ-liệu--tính-năng-chẩn-đoán)
3. [Hướng Dẫn Kết Nối Ứng Dụng Lên Điện Thoại Qua Expo Go](#3-hướng-dẫn-kết-nối-ứng-dụng-lên-điện-thoại-qua-expo-go)
4. [Hướng Dẫn Đăng Nhập Bằng Access Token Khi Dùng GitHub SSO](#4-hướng-dẫn-đăng-nhập-bằng-access-token-khi-dùng-github-sso)
5. [Xử Lý Sự Cố Thường Gặp Khi Chạy Trên Điện Thoại](#5-xử-lý-sự-cố-thường-gặp-khi-chạy-trên-điện-thoại)

---

## 1. TỔNG HỢP CÁC THAY ĐỔI & NÂNG CẤP GIAO DIỆN MỚI

### 🌿 Tone màu Bắc Âu (Scandinavian Sage & Linen)
- **Nền ứng dụng:** Chuyển sang màu xám ngọc trai pha ánh xanh rêu siêu nhẹ (`#F6F8F5`), mang lại cảm giác dễ chịu, thoáng đãng.
- **Thẻ hiển thị (Cards):** Nền trắng tinh khôi (`#FFFFFF`), viền mỏng thanh lịch (`#E3ECE5`) kết hợp hiệu ứng đổ bóng đa tầng (`shadows.soft` / `shadows.card`).
- **Màu chủ đạo (Primary):** Xanh xô thơm (**Sage Green `#2D6A4F`**) thay thế màu xanh neon AI.
- **Màu dữ liệu cảm biến:**
  - Nhiệt độ / Ánh sáng: Hổ phách ấm (`#D9822B`).
  - Độ ẩm không khí: Xanh lam nước dịu (`#2E86AB`).
  - Độ ẩm đất: Nâu đất hữu cơ (`#8D6E63`).

### 💊 Thanh điều hướng nổi dạng viên thuốc (Floating Pill Navbar - Meta Threads Style)
- **Kiểu dáng:** Bo tròn hoàn toàn (`borderRadius: 9999`), nổi lơ lửng cách đáy màn hình `16px - 24px`.
- **Hiệu ứng cuộn thông minh (Scroll-Aware Animation):**
  - **Cuộn xuống (Scroll Down):** Tự động trượt êm xuống dưới biến mất (`translateY: 110`), giải phóng 100% không gian hiển thị cho cảm biến & biểu đồ.
  - **Cuộn lên (Scroll Up):** Lập tức nhô lên xuất hiện trở lại để bạn thao tác.
  - **Đầu trang:** Luôn luôn hiển thị đầy đủ.
- **Tối ưu tên nhãn tab:** Rút gọn thành **"Tổng quan"**, **"Điều khiển"**, **"Chẩn đoán"** giúp hiển thị trọn vẹn 100% không bị cắt dấu `...`.

---

## 2. CƠ CHẾ PHÂN TÍCH DỮ LIỆU & TÍNH NĂNG CHẨN ĐOÁN

### 🔹 Cách hệ thống lấy dữ liệu và sinh chẩn đoán:
Hệ thống sử dụng **Hệ chuyên gia nông học (Rule-Based Expert Engine)** phân tích thời gian thực 4 thông số:
1. **Nhiệt độ & Độ ẩm không khí** (SHT31 qua giao thức I2C).
2. **Độ ẩm đất** (Cảm biến điện dung qua chân Analog ADC).
3. **Cường độ ánh sáng** (BH1750 qua giao thức I2C).

**Ví dụ logic chẩn đoán:**
- Khi độ ẩm đất $< 40\%$: Cảnh báo *"Đất đang khô"* $\rightarrow$ Khuyến nghị *"Bật máy bơm tưới nước 5 phút"*.
- Khi nhiệt độ $> 32^\circ\text{C}$ + độ ẩm không khí $< 50\%$: Cảnh báo *"Tốc độ bốc hơi nước nhanh, cây dễ héo"*.
- Khi độ ẩm không khí $> 85\%$ kéo dài: Cảnh báo *"Nguy cơ nấm mốc và rệp lá phát triển"*.

### 🔹 Có nên tích hợp thêm AI LLM (Gemini / OpenAI API) không?
- **Với hệ thống hiện tại:** Logic Rule-based chạy trực tiếp trên ESP32/Frontend là giải pháp **tốt nhất**, phản hồi tức thì ($< 5\text{ms}$), hoạt động offline không cần internet, 0% lỗi ảo giác và không tốn tiền API.
- **Nên thêm AI LLM khi:** Bạn muốn mở rộng tính năng **Chatbot trợ lý nông dân hỏi đáp kinh nghiệm trồng trọt** hoặc **Nhận diện sâu bệnh qua ảnh chụp lá cây (Computer Vision)**.

---

## 3. HƯỚNG DẪN KẾT NỐI ỨNG DỤNG LÊN ĐIỆN THOẠI QUA EXPO GO

### Bước 1: Cài đặt ứng dụng Expo Go trên điện thoại
- **iPhone (iOS):** Vào App Store tìm và tải ứng dụng **Expo Go**.
- **Android:** Vào Google Play Store tìm và tải ứng dụng **Expo Go**.

### Bước 2: Khởi chạy dự án trên máy tính
Dự án đã được tích hợp mã ID dự án trên Expo (`projectId: "0e95295b-6ed9-4eeb-8222-b0267b29d9a5"`).

> [!WARNING]
> **TẠI SAO KHÔNG NÊN CHẠY `npm start` THÔNG THƯỜNG?**
> - Khi bạn chạy `npm start` mặc định, Expo sẽ tự động dò card mạng. Trên máy tính Windows có cài máy ảo **VMware / VirtualBox**, Expo thường nhận nhầm IP ảo (`192.168.6.x` hoặc `192.168.47.x`) thay vì IP Wi-Fi thật.
> - Đồng thời nếu điện thoại của bạn đang dùng **4G/5G** hoặc đang phát **Hotspot**, điện thoại và máy tính không chung mạng nội bộ $\rightarrow$ Sẽ báo lỗi **"The request timed out"** hoặc app không thể load được.
> - **Giải pháp tối ưu 100%:** Luôn sử dụng chế độ **Tunnel** hoặc click đúp file chạy nhanh bên dưới!

---

#### 🌟 Cách 1: Chạy 1-Click bằng file kịch bản có sẵn (Nhanh nhất)
- **Nếu dùng Command Prompt (CMD):** Click đúp chuột vào file [`chay_tunnel.bat`](file:///d:/WebsiteAppFullProject/IOT/chay_tunnel.bat) hoặc gõ `chay_tunnel.bat`.
- **Nếu dùng PowerShell:** Chạy file `.\chay_tunnel.ps1`.
- **Hoặc chạy qua npm:** (Token đã được lưu sẵn trong file `.env`):
  ```bash
  npm run start:tunnel
  ```

---

#### ⚡ Cách 2: Gõ lệnh trực tiếp trong Terminal

##### A. Dành cho **Command Prompt (CMD)** (Màn hình đen truyền thống):
```cmd
set EXPO_TOKEN=DVmH1hTv_U2pWrJ3LL1nQ_GG6Za9vbImmHxqubsU && npx expo start --tunnel
```
*(Nếu muốn chạy qua IP Hotspot nội bộ: `set REACT_NATIVE_PACKAGER_HOSTNAME=172.20.10.2 && npx expo start -c`)*

##### B. Dành cho **PowerShell** (Màn hình xanh / VS Code Terminal PowerShell):
```powershell
$env:EXPO_TOKEN="DVmH1hTv_U2pWrJ3LL1nQ_GG6Za9vbImmHxqubsU"; npx expo start --tunnel
```
*(Nếu muốn chạy qua IP Hotspot nội bộ: `$env:REACT_NATIVE_PACKAGER_HOSTNAME="172.20.10.2"; npx expo start -c`)*

---

### Bước 3: Mở ứng dụng trên điện thoại
- **Cách 1 (Mở trực tiếp từ tài khoản):** Mở app Expo Go $\rightarrow$ Đăng nhập tài khoản Expo $\rightarrow$ Chạm vào dự án **"AIoT Nông nghiệp"** hiển thị sẵn tại trang chủ.
- **Cách 2 (Quét mã QR):** Dùng Camera điện thoại quét mã QR hiển thị ở màn hình Terminal máy tính.

---

## 4. HƯỚNG DẪN ĐĂNG NHẬP BẰNG ACCESS TOKEN KHI DÙNG GITHUB SSO

Khi bạn tạo tài khoản Expo bằng cách đăng nhập qua **GitHub / Google (Single Sign-On)**, tài khoản sẽ không có mật khẩu trực tiếp. Để đăng nhập Expo CLI trên máy tính:

1. Mở trình duyệt và truy cập: **[expo.dev/settings/access-tokens](https://expo.dev/settings/access-tokens)**.
2. Bấm nút **"Create Token"** $\rightarrow$ Đặt tên bất kỳ (ví dụ: `my-laptop-token`) $\rightarrow$ Bấm **Create**.
3. Copy chuỗi Token được tạo ra (dạng: `DVmH1hTv_U2p...`).
4. Thiết lập biến môi trường:
   - **Trên CMD:** `set EXPO_TOKEN=<dán_mã_token>`
   - **Trên PowerShell:** `$env:EXPO_TOKEN="<dán_mã_token>"`
   *(Hoặc lưu thẳng vào file `.env` dòng `EXPO_TOKEN=<mã_token>` như dự án đã cấu hình sẵn).*
5. Kiểm tra đăng nhập thành công bằng lệnh:
   ```powershell
   npx expo whoami
   ```
   *(Kết quả in ra đúng tên tài khoản của bạn: `manhtieniot`).*

---

## 5. XỬ LÝ SỰ CỐ THƯỜNG GẶP KHI CHẠY TRÊN ĐIỆN THOẠI

| Sự cố | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| **Báo lỗi `The request timed out`** | Điện thoại bật 5G/Hotspot hoặc Expo nhận nhầm card mạng ảo VMware | Chạy file `chay_tunnel.bat` hoặc lệnh `npm run start:tunnel` để tạo kết nối Tunnel toàn cầu. |
| **Lỗi `The filename, directory name, or volume label syntax is incorrect`** | Đang ở cửa sổ **CMD** nhưng lại gõ lệnh của **PowerShell** (`$env:...`) | Dùng cú pháp của CMD: `set EXPO_TOKEN=... && npx expo start --tunnel` hoặc click file `chay_tunnel.bat`. |
| **Báo lỗi `Project is incompatible (SDK 54 vs SDK 57)`** | Expo Go trên điện thoại đã cập nhật SDK 57 nhưng dự án dùng SDK cũ | Dự án hiện tại đã được nâng cấp lên **SDK 57**, chỉ cần chạy lại `npx expo start -c`. |
| **Báo lỗi `You need to be signed in to Expo Go`** | Chưa có Token xác thực khi chạy Tunnel | Chạy lệnh gán `EXPO_TOKEN` như hướng dẫn ở Bước 2. |
| **PowerShell báo lỗi `The term 'DVmH...' is not recognized`** | Quên đặt mã token vào trong dấu ngoặc kép `""` | Gõ đúng cú pháp: `$env:EXPO_TOKEN="<mã_token>"`. |
| **Không tải được Expo Go trên iPhone** | Máy iPhone quá cũ hoặc chưa có tài khoản Apple ID | Mở trực tiếp bằng Safari trên iPhone qua địa chỉ: `http://<IP_MÁY_TÍNH>:8082` (chạy lệnh `npx expo start --web`). |

---

> 💡 **Mẹo:** Để trải nghiệm ứng dụng mượt mà nhất trên máy tính khi đang code, bạn luôn có thể mở phiên bản Web bằng lệnh:
> ```bash
> npm run web
> ```
> Trình duyệt sẽ tự động mở tại `http://localhost:8082`.
