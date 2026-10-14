// Dịch vụ dự báo thời tiết khí tượng nông nghiệp sử dụng Open-Meteo API (Miễn phí, không cần API key)
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface OutdoorWeather {
  temperature: number;
  humidity: number;
  weatherCode: number;
  weatherDescription: string;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'clear_night' | 'cloudy_night';
  isDay: boolean; // true = ban ngày, false = ban đêm
  rainProbability: number; // Tỉ lệ mưa cao nhất trong các giờ tới (%)
  windSpeed: number; // km/h
  locationName: string;
  updatedAt: string;
}

export interface FarmLocation {
  id: string;
  name: string;
  region: string;
  latitude: number;
  longitude: number;
}

export const VIETNAM_FARM_LOCATIONS: FarmLocation[] = [
  { id: 'hanoi', name: 'Hà Nội', region: 'Miền Bắc (Đan Phượng / Mê Linh)', latitude: 21.0285, longitude: 105.8542 },
  { id: 'bacninh', name: 'Bắc Ninh', region: 'Miền Bắc (Gia Bình / Thuận Thành)', latitude: 21.1861, longitude: 106.0763 },
  { id: 'haiduong', name: 'Hải Dương', region: 'Miền Bắc (Nam Sách / Thanh Hà)', latitude: 20.9373, longitude: 106.3146 },
  { id: 'hungyen', name: 'Hưng Yên', region: 'Miền Bắc (Khoái Châu / Văn Giang)', latitude: 20.6464, longitude: 106.0511 },
  { id: 'vinhphuc', name: 'Vĩnh Phúc', region: 'Miền Bắc (Tam Dương / Vĩnh Tường)', latitude: 21.3609, longitude: 105.5474 },
  { id: 'danang', name: 'Đà Nẵng', region: 'Miền Trung (Hòa Vang)', latitude: 16.0544, longitude: 108.2022 },
  { id: 'nghean', name: 'Nghệ An', region: 'Miền Trung (Nam Đàn / Nghi Lộc)', latitude: 18.6734, longitude: 105.6813 },
  { id: 'thanhhoa', name: 'Thanh Hóa', region: 'Miền Trung (Yên Định / Thọ Xuân)', latitude: 19.8067, longitude: 105.7852 },
  { id: 'dalat', name: 'Lâm Đồng - Đà Lạt', region: 'Tây Nguyên (Đà Lạt / Đức Trọng)', latitude: 11.9404, longitude: 108.4583 },
  { id: 'daklak', name: 'Đắk Lắk', region: 'Tây Nguyên (Buôn Ma Thuột / Cư M\'gar)', latitude: 12.6667, longitude: 108.0383 },
  { id: 'gialai', name: 'Gia Lai', region: 'Tây Nguyên (Pleiku / Chư Sê)', latitude: 13.9833, longitude: 108.0000 },
  { id: 'hcm', name: 'TP. Hồ Chí Minh', region: 'Miền Nam (Củ Chi / Hóc Môn)', latitude: 10.8231, longitude: 106.6297 },
  { id: 'binhduong', name: 'Bình Dương', region: 'Miền Nam (Bến Cát / Phú Giáo)', latitude: 11.1322, longitude: 106.6570 },
  { id: 'dongnai', name: 'Đồng Nai', region: 'Miền Nam (Long Khánh / Định Quán)', latitude: 10.9574, longitude: 106.8427 },
  { id: 'binhphuoc', name: 'Bình Phước', region: 'Miền Nam (Chơn Thành / Đồng Xoài)', latitude: 11.7511, longitude: 106.9042 },
  { id: 'tayninh', name: 'Tây Ninh', region: 'Miền Nam (Dương Minh Châu)', latitude: 11.3541, longitude: 106.0967 },
  { id: 'longan', name: 'Long An', region: 'ĐBSCL (Đức Hòa / Bến Lức)', latitude: 10.5333, longitude: 106.4000 },
  { id: 'tiengiang', name: 'Tiền Giang', region: 'ĐBSCL (Chợ Gạo / Cai Lậy)', latitude: 10.4493, longitude: 106.3421 },
  { id: 'cantho', name: 'Cần Thơ', region: 'ĐBSCL (Phong Điền / Ô Môn)', latitude: 10.0452, longitude: 105.7469 },
  { id: 'bentre', name: 'Bến Tre', region: 'ĐBSCL (Châu Thành / Chợ Lách)', latitude: 10.2415, longitude: 106.3759 },
];

const STORAGE_KEY_LOCATION = '@aiot_farm_weather_location';

export async function getSavedFarmLocation(): Promise<FarmLocation> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_LOCATION);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return VIETNAM_FARM_LOCATIONS[0]; // Mặc định: Hà Nội
}

export async function saveFarmLocation(loc: FarmLocation): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_LOCATION, JSON.stringify(loc));
  } catch {}
}

// Bảng ánh xạ mã WMO sang mô tả tiếng Việt và phân loại ngày/đêm
function mapWmoCode(
  code: number,
  isDay: boolean
): { description: string; condition: OutdoorWeather['condition'] } {
  if (code === 0) {
    return isDay
      ? { description: 'Trời quang, nắng đẹp', condition: 'sunny' }
      : { description: 'Đêm quang mây, mát mẻ', condition: 'clear_night' };
  }
  if (code <= 3) {
    return isDay
      ? { description: 'Trời có mây rải rác', condition: 'cloudy' }
      : { description: 'Đêm nhiều mây, dịu mát', condition: 'cloudy_night' };
  }
  if (code === 45 || code === 48) {
    return isDay
      ? { description: 'Sương mù ẩm', condition: 'cloudy' }
      : { description: 'Đêm nhiều sương mù ẩm', condition: 'cloudy_night' };
  }
  if (code >= 51 && code <= 57) {
    return { description: isDay ? 'Mưa phùn rải rác' : 'Đêm có mưa phùn', condition: 'rainy' };
  }
  if (code >= 61 && code <= 67) {
    return { description: isDay ? 'Mưa rào' : 'Đêm có mưa rào', condition: 'rainy' };
  }
  if (code >= 80 && code <= 82) {
    return { description: isDay ? 'Mưa rào nặng hạt' : 'Đêm mưa rào nặng hạt', condition: 'rainy' };
  }
  if (code >= 95) {
    return { description: 'Dông bão, sấm sét', condition: 'stormy' };
  }
  return isDay
    ? { description: 'Nhiều mây', condition: 'cloudy' }
    : { description: 'Đêm nhiều mây', condition: 'cloudy_night' };
}

// ============================================================
// BỘ ĐỆM CACHE THỜI TIẾT (Tránh bắn request liên tục mỗi vài giây)
// ============================================================
let cachedWeather: OutdoorWeather | null = null;
let lastWeatherFetchTime = 0;
let cachedLocationKey = '';
const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000; // 10 phút

// Lấy thời tiết từ Open-Meteo API
export async function getOutdoorWeather(
  latitude?: number,
  longitude?: number,
  locationName?: string,
  forceRefresh = false
): Promise<OutdoorWeather> {
  let lat = latitude;
  let lon = longitude;
  let name = locationName;

  if (lat === undefined || lon === undefined || !name) {
    const saved = await getSavedFarmLocation();
    lat = saved.latitude;
    lon = saved.longitude;
    name = saved.name;
  }

  const locKey = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  const now = Date.now();

  // Nếu còn hạn bộ đệm cache (< 10 phút), cùng địa điểm và không bị ép làm mới
  if (
    !forceRefresh &&
    cachedWeather &&
    cachedLocationKey === locKey &&
    now - lastWeatherFetchTime < WEATHER_CACHE_TTL_MS
  ) {
    return cachedWeather;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day&hourly=precipitation_probability&forecast_days=2&timezone=Asia%2FBangkok`;

  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const data = await res.json();

    const current = data.current || {};
    const isDay =
      current.is_day !== undefined
        ? current.is_day === 1
        : new Date().getHours() >= 6 && new Date().getHours() < 18;

    const hourlyRain: number[] = data.hourly?.precipitation_probability || [];
    const currentHour = new Date().getHours();
    // Lấy xác suất mưa cao nhất trong 6 - 8 giờ tới kể từ giờ hiện tại
    const upcomingRain = hourlyRain.slice(currentHour, currentHour + 8);
    const maxRainProb = upcomingRain.length > 0 ? Math.max(...upcomingRain) : (hourlyRain[currentHour] ?? 0);

    const { description, condition } = mapWmoCode(current.weather_code ?? 0, isDay);

    const result: OutdoorWeather = {
      temperature: Math.round((current.temperature_2m ?? 28) * 10) / 10,
      humidity: Math.round(current.relative_humidity_2m ?? 70),
      weatherCode: current.weather_code ?? 0,
      weatherDescription: description,
      condition,
      isDay,
      rainProbability: maxRainProb,
      windSpeed: Math.round(current.wind_speed_10m ?? 10),
      locationName: name,
      updatedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };

    cachedWeather = result;
    cachedLocationKey = locKey;
    lastWeatherFetchTime = now;
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    console.warn('Không thể lấy thời tiết Open-Meteo, dùng dữ liệu dự phòng:', error);

    // Nếu từng có cache trước đó cho vị trí này thì dùng lại thay vì sinh dữ liệu mẫu
    if (cachedWeather && cachedLocationKey === locKey) {
      return cachedWeather;
    }

    const currentHour = new Date().getHours();
    const isDay = currentHour >= 6 && currentHour < 18;
    return {
      temperature: isDay ? 29.5 : 24.5,
      humidity: isDay ? 72 : 85,
      weatherCode: 1,
      weatherDescription: isDay ? 'Trời có mây (Dự phòng)' : 'Đêm mát mẻ (Dự phòng)',
      condition: isDay ? 'cloudy' : 'cloudy_night',
      isDay,
      rainProbability: 15,
      windSpeed: 10,
      locationName: name,
      updatedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };
  }
}

