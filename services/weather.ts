// Dịch vụ dự báo thời tiết ngoài trời sử dụng Open-Meteo API (Miễn phí, không cần key)

export interface OutdoorWeather {
  temperature: number;
  humidity: number;
  weatherCode: number;
  weatherDescription: string;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy';
  rainProbability: number; // Tỉ lệ mưa cao nhất trong ngày (%)
  windSpeed: number; // km/h
  locationName: string;
  updatedAt: string;
}

// Bảng ánh xạ mã WMO sang mô tả tiếng Việt và phân loại
function mapWmoCode(code: number): { description: string; condition: OutdoorWeather['condition'] } {
  if (code === 0) {
    return { description: 'Trời quang, nắng đẹp', condition: 'sunny' };
  }
  if (code <= 3) {
    return { description: 'Trời có mây rải rác', condition: 'cloudy' };
  }
  if (code === 45 || code === 48) {
    return { description: 'Sương mù ẩm', condition: 'cloudy' };
  }
  if (code >= 51 && code <= 57) {
    return { description: 'Mưa phùn rải rác', condition: 'rainy' };
  }
  if (code >= 61 && code <= 67) {
    return { description: 'Mưa rào', condition: 'rainy' };
  }
  if (code >= 80 && code <= 82) {
    return { description: 'Mưa rào nặng hạt', condition: 'rainy' };
  }
  if (code >= 95) {
    return { description: 'Dông bão, sấm sét', condition: 'stormy' };
  }
  return { description: 'Nhiều mây', condition: 'cloudy' };
}

// Tọa độ mặc định: Hà Nội (21.0285, 105.8542)
export async function getOutdoorWeather(
  latitude = 21.0285,
  longitude = 105.8542,
  locationName = 'Hà Nội'
): Promise<OutdoorWeather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=precipitation_probability&forecast_days=1&timezone=Asia%2FBangkok`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }
    const data = await res.json();

    const current = data.current || {};
    const hourlyRain: number[] = data.hourly?.precipitation_probability || [];
    // Lấy xác suất mưa cao nhất trong các giờ tới
    const maxRainProb = hourlyRain.length > 0 ? Math.max(...hourlyRain.slice(0, 12)) : 0;

    const { description, condition } = mapWmoCode(current.weather_code ?? 0);

    return {
      temperature: Math.round((current.temperature_2m ?? 28) * 10) / 10,
      humidity: Math.round(current.relative_humidity_2m ?? 70),
      weatherCode: current.weather_code ?? 0,
      weatherDescription: description,
      condition,
      rainProbability: maxRainProb,
      windSpeed: Math.round(current.wind_speed_10m ?? 10),
      locationName,
      updatedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };
  } catch (error) {
    console.warn('Không thể lấy thời tiết Open-Meteo, dùng dữ liệu dự phòng:', error);
    // Dữ liệu dự phòng khi ngoại tuyến
    return {
      temperature: 29.5,
      humidity: 72,
      weatherCode: 1,
      weatherDescription: 'Trời có mây (Dự phòng)',
      condition: 'cloudy',
      rainProbability: 25,
      windSpeed: 12,
      locationName,
      updatedAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    };
  }
}
