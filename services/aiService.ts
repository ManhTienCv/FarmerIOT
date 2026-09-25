import type { AIInsight, SensorReading } from '@/types';
import type { OutdoorWeather } from './weather';

export interface AIAnalysisResult {
  insights: AIInsight[];
  provider: 'gemini' | 'groq' | 'local';
  providerName: string;
  weather?: OutdoorWeather;
  timestamp: string;
}

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';

// Tạo System Prompt chuyên gia nông nghiệp
function buildPrompt(sensors: SensorReading[], weather?: OutdoorWeather): string {
  const sensorMap: Record<string, number> = {};
  sensors.forEach((s) => {
    sensorMap[s.type] = s.value;
  });

  const temp = sensorMap.temperature ?? 28;
  const airH = sensorMap.airHumidity ?? 75;
  const soilH = sensorMap.soilMoisture ?? 40;
  const light = sensorMap.light ?? 12000;

  const weatherContext = weather
    ? `- Thời tiết bên ngoài (${weather.locationName}): ${weather.temperature}°C, Độ ẩm: ${weather.humidity}%, ${weather.weatherDescription}, Xác suất mưa: ${weather.rainProbability}%, Gió: ${weather.windSpeed} km/h.`
    : '- Chưa có dữ liệu thời tiết ngoài trời.';

  return `Bạn là một Kỹ sư Nông nghiệp Công nghệ cao (Agronomist AI).
Dữ liệu cảm biến thời gian thực tại vườn:
- Nhiệt độ vườn: ${temp}°C
- Độ ẩm không khí: ${airH}%
- Độ ẩm đất: ${soilH}%
- Cường độ ánh sáng: ${light} lx
Thời tiết ngoài trời:
${weatherContext}

HÃY ĐƯA RA TỪ 2 ĐẾN 4 CHẨN ĐOÁN VÀ KHUYẾN NGHỊ CHÍNH XÁC:
- Kết hợp sâu sắc số liệu cảm biến thực tế và điều kiện thời tiết ngoài trời.
- Nếu độ ẩm đất thấp nhưng ngoài trời có nguy cơ mưa cao (>65%), khuyến nghị hoãn tưới để tránh ngập úng rễ.
- Đánh giá nguy cơ nấm bệnh, rệp, thoát hơi nước, hoặc quang hợp.

BẮT BUỘC TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON SAU (không thêm markdown ngoài JSON):
{
  "insights": [
    {
      "id": "1",
      "title": "Tiêu đề ngắn dưới 7 từ",
      "description": "Giải thích nguyên nhân và hiện trạng (1-2 câu ngắn)",
      "level": "danger" | "warning" | "success" | "info",
      "confidence": 90,
      "recommendation": "Khuyến nghị hành động cụ thể cho nông dân (1-2 câu)"
    }
  ]
}`;
}

// 1. Gọi Google Gemini API
async function callGemini(prompt: string): Promise<AIInsight[]> {
  if (!GEMINI_API_KEY) throw new Error('Chưa có Gemini API Key');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Không nhận được nội dung từ Gemini');

  const parsed = JSON.parse(text);
  if (Array.isArray(parsed.insights) && parsed.insights.length > 0) {
    const now = new Date().toISOString();
    return parsed.insights.map((item: any, idx: number) => ({
      id: item.id || `gemini-${idx + 1}`,
      title: String(item.title || 'Khuyến nghị Nông học'),
      description: String(item.description || ''),
      level: (['danger', 'warning', 'success', 'info'].includes(item.level) ? item.level : 'info') as any,
      confidence: typeof item.confidence === 'number' ? item.confidence : 88,
      recommendation: String(item.recommendation || ''),
      createdAt: now,
    }));
  }
  throw new Error('Dữ liệu Gemini trả về không đúng cấu trúc');
}

// 2. Gọi Groq API (Fallback cấp 1)
async function callGroq(prompt: string): Promise<AIInsight[]> {
  if (!GROQ_API_KEY) throw new Error('Chưa có Groq API Key');

  const url = 'https://api.groq.com/openai/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-oss-20b',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    }),
    signal: AbortSignal.timeout(8000),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Không nhận được nội dung từ Groq');

  const parsed = JSON.parse(text);
  if (Array.isArray(parsed.insights) && parsed.insights.length > 0) {
    const now = new Date().toISOString();
    return parsed.insights.map((item: any, idx: number) => ({
      id: item.id || `groq-${idx + 1}`,
      title: String(item.title || 'Khuyến nghị Nông học'),
      description: String(item.description || ''),
      level: (['danger', 'warning', 'success', 'info'].includes(item.level) ? item.level : 'info') as any,
      confidence: typeof item.confidence === 'number' ? item.confidence : 85,
      recommendation: String(item.recommendation || ''),
      createdAt: now,
    }));
  }
  throw new Error('Dữ liệu Groq trả về không đúng cấu trúc');
}

// 3. Fallback Hệ chuyên gia Cục bộ (Khi không có mạng hoặc cả 2 AI đều lỗi)
function getLocalHeuristicInsights(sensors: SensorReading[], weather?: OutdoorWeather): AIInsight[] {
  const sensorMap: Record<string, number> = {};
  sensors.forEach((s) => {
    sensorMap[s.type] = s.value;
  });

  const temp = sensorMap.temperature ?? 28;
  const airH = sensorMap.airHumidity ?? 75;
  const soilH = sensorMap.soilMoisture ?? 40;
  const light = sensorMap.light ?? 12000;
  const rainProb = weather?.rainProbability ?? 0;

  const now = new Date().toISOString();
  const insights: AIInsight[] = [];

  // Logic đất & thời tiết
  if (soilH < 40) {
    if (rainProb >= 60) {
      insights.push({
        id: 'soil-rain-wait',
        title: 'Đất khô nhưng ngoài trời sắp mưa',
        description: `Độ ẩm đất hiện tại là ${soilH}%, tuy nhiên dự báo thời tiết ngoài trời có xác suất mưa ${rainProb}%.`,
        level: 'warning',
        confidence: 90,
        recommendation: 'Tạm hoãn bật máy bơm tưới gốc để tận dụng nước mưa tự nhiên và tránh thối rễ.',
        createdAt: now,
      });
    } else {
      insights.push({
        id: 'soil-dry',
        title: 'Đất đang thiếu nước nghiêm trọng',
        description: `Độ ẩm đất chỉ đạt ${soilH}%, thấp hơn ngưỡng sinh trưởng tối thiểu (50%).`,
        level: 'danger',
        confidence: 95,
        recommendation: 'Kích hoạt máy bơm tưới nhỏ giọt trong 5-10 phút để cấp ẩm lại cho vùng rễ.',
        createdAt: now,
      });
    }
  } else if (soilH > 80) {
    insights.push({
      id: 'soil-wet',
      title: 'Đất quá ẩm, nguy cơ nghẹt rễ',
      description: `Độ ẩm đất đo được ${soilH}%, đất đang bão hòa nước gây giảm lượng oxy rễ.`,
      level: 'warning',
      confidence: 88,
      recommendation: 'Ngừng mọi hoạt động tưới, kiểm tra rãnh thoát nước đáy chậu/luống.',
      createdAt: now,
    });
  }

  // Logic nấm bệnh
  if (airH > 85 && temp >= 25 && temp <= 32) {
    insights.push({
      id: 'disease-risk',
      title: 'Nguy cơ bùng phát nấm mốc & thán thư',
      description: `Nhiệt độ ${temp}°C và độ ẩm không khí ${airH}% kéo dài là môi trường tối ưu cho bào tử nấm.`,
      level: 'danger',
      confidence: 86,
      recommendation: 'Bật quạt thông gió đối lưu trong 15 phút và kiểm tra bề mặt lá dưới.',
      createdAt: now,
    });
  }

  // Logic ánh sáng
  if (light < 3000) {
    insights.push({
      id: 'light-low',
      title: 'Thiếu sáng quang hợp',
      description: `Cường độ ánh sáng chỉ đạt ${light} lx, cây trồng không đạt hiệu suất tích lũy đường bột tối ưu.`,
      level: 'info',
      confidence: 82,
      recommendation: 'Bật đèn LED quang hợp chuyên dụng bổ sung 2 giờ.',
      createdAt: now,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'all-optimal',
      title: 'Môi trường sinh thái lý tưởng',
      description: `Tất cả chỉ số (Nhiệt: ${temp}°C, Ẩm: ${airH}%, Đất: ${soilH}%) đều nằm trong ngưỡng vàng.`,
      level: 'success',
      confidence: 96,
      recommendation: 'Duy trì chế độ chăm sóc và quan trắc định kỳ hiện tại.',
      createdAt: now,
    });
  }

  return insights;
}

// Hàm điều phối chính (Cascade Failover: Gemini -> Groq -> Local)
export async function analyzeAgricultureData(
  sensors: SensorReading[],
  weather?: OutdoorWeather
): Promise<AIAnalysisResult> {
  const prompt = buildPrompt(sensors, weather);
  const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // 1. Thử Gemini trước
  try {
    const geminiInsights = await callGemini(prompt);
    return {
      insights: geminiInsights,
      provider: 'gemini',
      providerName: 'Google Gemini 3.6 Flash',
      weather,
      timestamp: now,
    };
  } catch (geminiError) {
    console.warn('Gemini lỗi, chuyển sang Groq:', (geminiError as Error).message);
  }

  // 2. Fallback sang Groq
  try {
    const groqInsights = await callGroq(prompt);
    return {
      insights: groqInsights,
      provider: 'groq',
      providerName: 'Groq Cloud (GPT-OSS)',
      weather,
      timestamp: now,
    };
  } catch (groqError) {
    console.warn('Groq lỗi, chuyển sang Hệ chuyên gia cục bộ:', (groqError as Error).message);
  }

  // 3. Fallback sang Hệ chuyên gia nông học cục bộ
  const localInsights = getLocalHeuristicInsights(sensors, weather);
  return {
    insights: localInsights,
    provider: 'local',
    providerName: 'Hệ chuyên gia Nông học Cục bộ (Offline)',
    weather,
    timestamp: now,
  };
}
