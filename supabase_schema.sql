-- =========================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU NÔNG NGHIỆP THÔNG MINH AIoT (SUPABASE / POSTGRESQL)
-- Chạy script này trong mục SQL Editor trên trang quản trị Supabase
-- =========================================================================

-- 1. BẢNG LƯU TRỮ CHUỖI THỜI GIAN CẢM BIẾN (TELEMETRY)
CREATE TABLE IF NOT EXISTS public.sensor_telemetry (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    temperature NUMERIC(5, 2),        -- Nhiệt độ (°C)
    air_humidity NUMERIC(5, 2),       -- Độ ẩm không khí (%)
    soil_moisture NUMERIC(5, 2),      -- Độ ẩm đất (%)
    light NUMERIC(8, 2),              -- Cường độ ánh sáng (lux)
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Tạo chỉ mục (Index) để truy vấn lịch sử nhanh theo thời gian
CREATE INDEX IF NOT EXISTS idx_sensor_telemetry_recorded_at 
ON public.sensor_telemetry (recorded_at DESC);

-- 2. BẢNG LƯU TRỮ LỊCH SỬ ĐIỀU KHIỂN THIẾT BỊ (BƠM / ĐÈN)
CREATE TABLE IF NOT EXISTS public.device_events (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    device_type TEXT NOT NULL,         -- 'pump' hoặc 'growLight'
    is_on BOOLEAN NOT NULL,            -- TRUE = Bật, FALSE = Tắt
    toggled_by TEXT DEFAULT 'user',    -- 'user', 'ai_auto', 'hardware_button'
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_device_events_recorded_at 
ON public.device_events (recorded_at DESC);

-- 3. BẢNG LƯU TRỮ NHẬT KÝ VỤ MÙA VÀ GHI CHÚ NÔNG NGHIỆP
CREATE TABLE IF NOT EXISTS public.crop_journals (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    crop_id TEXT NOT NULL,
    crop_name TEXT NOT NULL,
    stage_name TEXT NOT NULL,
    day_of_crop INTEGER DEFAULT 1,
    ai_diagnosis TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 4. KÍCH HOẠT CHÍNH SÁCH ROW LEVEL SECURITY (RLS) MỞ CHO PHÉP ĐỌC / GHI
ALTER TABLE public.sensor_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crop_journals ENABLE ROW LEVEL SECURITY;

-- Cho phép App đọc và thêm dữ liệu bằng Anon Key
CREATE POLICY "Cho phép đọc telemetry công khai" 
ON public.sensor_telemetry FOR SELECT USING (true);

CREATE POLICY "Cho phép ghi telemetry" 
ON public.sensor_telemetry FOR INSERT WITH CHECK (true);

CREATE POLICY "Cho phép đọc device events công khai" 
ON public.device_events FOR SELECT USING (true);

CREATE POLICY "Cho phép ghi device events" 
ON public.device_events FOR INSERT WITH CHECK (true);

CREATE POLICY "Cho phép đọc nhật ký vụ mùa" 
ON public.crop_journals FOR SELECT USING (true);

CREATE POLICY "Cho phép ghi nhật ký vụ mùa" 
ON public.crop_journals FOR INSERT WITH CHECK (true);
