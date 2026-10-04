// Dịch vụ Trí Tuệ Nhân Tạo Chẩn Đoán Nông Nghiệp Chính Xác (Precision Agriculture)
// Hỗ trợ Kiến trúc Lai Ghép Dự Phòng: Google Gemini 3.6 Flash -> Groq Cloud (GPT-OSS) -> Local Heuristics
import type { AIInsight, SensorReading } from '@/types';
import type { CropProfile, CropStageConfig } from '@/types/crop';
import type { OutdoorWeather } from './weather';

export interface PrecisionCropContext {
  crop: CropProfile;
  stage: CropStageConfig;
  dayOfCrop: number;
  calculatedVPD: number;
}

export interface AIAnalysisResult {
  insights: AIInsight[];
  provider: 'gemini' | 'groq' | 'local';
  providerName: string;
  weather?: OutdoorWeather;
  timestamp: string;
}

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';

// Tạo System Prompt chuyên gia nông nghiệp bám sát từng giống cây trồng & thời tiết
function buildPrompt(
  sensors: SensorReading[],
  weather?: OutdoorWeather,
  cropContext?: PrecisionCropContext
): string {
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

  let cropSection = '';
  if (cropContext) {
    const { crop, stage, dayOfCrop, calculatedVPD } = cropContext;
    cropSection = `
THÔNG TIN VỤ MÙA ĐANG CANH TÁC:
- Cây trồng: ${crop.name} (${crop.scientificName}) - Nhóm: ${crop.category}
- Tiến độ: Ngày ${dayOfCrop} / ${crop.totalDays} ngày tổng chu kỳ
- Giai đoạn sinh học: ${stage.name} (${stage.daysRange})
- Ngưỡng tối ưu chuẩn khoa học ở giai đoạn này:
  + Nhiệt độ tối ưu: ${stage.temperature.optimalMin}°C - ${stage.temperature.optimalMax}°C (Hiện tại: ${temp}°C)
  + Độ ẩm đất tối ưu: ${stage.soilMoisture.optimalMin}% - ${stage.soilMoisture.optimalMax}% (Hiện tại: ${soilH}%)
  + Độ ẩm không khí tối ưu: ${stage.airHumidity.optimalMin}% - ${stage.airHumidity.optimalMax}% (Hiện tại: ${airH}%)
  + Ánh sáng tối ưu: ${stage.light.optimalMin} - ${stage.light.optimalMax} lux (Hiện tại: ${light} lx)
  + Chỉ số thoát hơi nước VPD tối ưu: ${stage.vpd.optimalMin} - ${stage.vpd.optimalMax} kPa (Tính toán thực tế: ${calculatedVPD} kPa)
- Lời khuyên nông học giai đoạn này: "${stage.advisoryNote}"`;
  }

  return `Bạn là một Kỹ sư Nông nghiệp Trưởng chuyên sâu canh tác Dưa Lưới Nhà Màng Công Nghệ Cao (Senior Melon Agronomist AI) tại Việt Nam.

Dữ liệu cảm biến thời gian thực tại vườn dưa lưới:
- Nhiệt độ vườn: ${temp}°C
- Độ ẩm không khí: ${airH}%
- Độ ẩm đất (giá thể bầu): ${soilH}%
- Cường độ ánh sáng: ${light} lx
Thời tiết ngoài trời:
${weatherContext}
${cropSection}

YÊU CẦU CHẨN ĐOÁN VÀ RA QUYẾT ĐỊNH NÔNG HỌC CHUYÊN SÂU DƯA LƯỚI:
1. Đánh giá trực tiếp hiện trạng nhà màng dưa lưới so với NGƯỠNG SINH HỌC CỤ THỂ ở giai đoạn hiện tại (Đặc biệt chú ý giai đoạn thụ phấn nách lá 10-12, lên vân lưới và tạo đường Brix).
2. Phân tích chỉ số VPD (${cropContext ? cropContext.calculatedVPD : 'tính toán'} kPa): Khí khổng đang ở vùng quang hợp cực đại hay đang chịu áp lực thoát hơi nước/đình trệ bốc hơi? Nếu độ ẩm >85% hoặc VPD <0.4 kPa, lập tức cảnh báo nguy cơ nấm phấn trắng và nứt trái.
3. Đánh giá cường độ ánh sáng (${light} lx): Tính toán nhu cầu bù sáng bằng đèn quang hợp để đảm bảo tích phân ánh sáng hàng ngày (DLI) giúp dưa đạt độ ngọt Brix ≥ 14%.
4. Kết hợp xác suất mưa ngoài trời để đưa ra chỉ thị tưới chính xác: Nếu ngoài trời sắp mưa to (>60%), phải hướng dẫn hệ thống Smart Pump tạm hoãn tưới để chống ngập úng bầu giá thể.
5. GIỚI HẠN THIẾT BỊ THỰC TẾ (BẮT BUỘC TUÂN THỦ):
   - Nhà màng CHỈ CÓ 2 thiết bị điều khiển tự động qua Rơ-le: [1] MÁY BƠM NƯỚC (tưới nhỏ giọt/tưới gốc) và [2] ĐÈN QUANG HỢP.
   - Nhà màng KHÔNG CÓ hệ thống phun sương tự động, KHÔNG CÓ máy tạo ẩm, KHÔNG CÓ quạt công nghiệp hay máy sưởi.
   - MỌI KHUYẾN NGHỊ HÀNH ĐỘNG chỉ được đề xuất: Bật/tắt máy bơm tưới nước, Bật/tắt đèn quang hợp, hoặc thao tác thủ công nông hộ (kéo lưới đen che bớt nắng, cuộn mở rèm lưới đón gió tự nhiên, tưới ướt lối đi/nền nhà màng để bốc hơi tạo ẩm tự nhiên). TUYỆT ĐỐI KHÔNG khuyến nghị phun sương hay cấp ẩm bằng máy.
6. Đưa ra từ 2 đến 4 khuyến nghị hành động thiết thực, ngắn gọn và có tính ứng dụng cao.

BẮT BUỘC TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON SAU (không thêm markdown ngoài JSON):
{
  "insights": [
    {
      "id": "1",
      "title": "Tiêu đề ngắn dưới 7 từ",
      "description": "Giải thích nguyên nhân sinh học và hiện trạng (1-2 câu ngắn)",
      "level": "danger" | "warning" | "success" | "info",
      "confidence": 92,
      "recommendation": "Khuyến nghị hành động cụ thể cho nông dân (1-2 câu)"
    }
  ]
}`;
}

function cleanJsonText(raw: string): string {
  return raw.replace(/```json/gi, '').replace(/```/g, '').trim();
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

  const parsed = JSON.parse(cleanJsonText(text));
  if (Array.isArray(parsed.insights) && parsed.insights.length > 0) {
    const now = new Date().toISOString();
    return parsed.insights.map((item: any, idx: number) => ({
      id: item.id || `gemini-${idx + 1}`,
      title: String(item.title || 'Khuyến nghị Nông học'),
      description: String(item.description || ''),
      level: (['danger', 'warning', 'success', 'info'].includes(item.level) ? item.level : 'info') as any,
      confidence: typeof item.confidence === 'number' ? item.confidence : 90,
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

  const parsed = JSON.parse(cleanJsonText(text));
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
function getLocalHeuristicInsights(
  sensors: SensorReading[],
  weather?: OutdoorWeather,
  cropContext?: PrecisionCropContext
): AIInsight[] {
  const sensorMap: Record<string, number> = {};
  sensors.forEach((s) => {
    sensorMap[s.type] = s.value;
  });

  const temp = sensorMap.temperature ?? 28;
  const airH = sensorMap.airHumidity ?? 75;
  const soilH = sensorMap.soilMoisture ?? 40;
  const light = sensorMap.light ?? 12000;
  const rainProb = weather?.rainProbability ?? 0;

  // Lấy ngưỡng mục tiêu từ cây trồng (nếu có)
  const soilOptMin = cropContext?.stage.soilMoisture.optimalMin ?? 60;
  const soilOptMax = cropContext?.stage.soilMoisture.optimalMax ?? 75;
  const tempOptMin = cropContext?.stage.temperature.optimalMin ?? 22;
  const tempOptMax = cropContext?.stage.temperature.optimalMax ?? 28;
  const cropName = cropContext ? `${cropContext.crop.name} (${cropContext.stage.name})` : 'cây trồng';

  const now = new Date().toISOString();
  const insights: AIInsight[] = [];

  // Logic độ ẩm đất theo cây
  if (soilH < soilOptMin) {
    if (rainProb >= 60) {
      insights.push({
        id: 'soil-rain-wait',
        title: 'Đất thiếu ẩm nhưng sắp có mưa',
        description: `Độ ẩm đất ${soilH}% thấp hơn chuẩn ${cropName} (${soilOptMin}%). Tuy nhiên ngoài trời có xác suất mưa ${rainProb}%.`,
        level: 'warning',
        confidence: 92,
        recommendation: 'Tạm hoãn tưới tự động để đón mưa tự nhiên, tránh thừa nước làm úng rễ.',
        createdAt: now,
      });
    } else {
      insights.push({
        id: 'soil-dry',
        title: `Đất dưới ngưỡng chuẩn ${cropName}`,
        description: `Độ ẩm đất chỉ đạt ${soilH}%, trong khi ${cropName} cần từ ${soilOptMin}% - ${soilOptMax}%.`,
        level: 'danger',
        confidence: 94,
        recommendation: 'Kích hoạt máy bơm tưới nhỏ giọt trong 5-8 phút để bù đắp ẩm vùng rễ.',
        createdAt: now,
      });
    }
  } else if (soilH > soilOptMax + 10) {
    insights.push({
      id: 'soil-wet',
      title: 'Đất dư ẩm, nguy cơ nghẹt rễ',
      description: `Độ ẩm đất đo được ${soilH}%, vượt ngưỡng tối đa (${soilOptMax}%) của ${cropName}.`,
      level: 'warning',
      confidence: 88,
      recommendation: 'Ngừng tưới nước, khơi thông rãnh thoát đáy chậu để rễ hô hấp.',
      createdAt: now,
    });
  }

  // Logic VPD & Khí khổng
  if (cropContext) {
    const vpd = cropContext.calculatedVPD;
    const vpdOptMin = cropContext.stage.vpd.optimalMin;
    const vpdOptMax = cropContext.stage.vpd.optimalMax;

    if (vpd >= vpdOptMin && vpd <= vpdOptMax) {
      insights.push({
        id: 'vpd-optimal',
        title: 'Khí khổng ở Vùng Quang Hợp Cực Đại',
        description: `Chỉ số VPD đạt ${vpd} kPa, nằm chuẩn xác trong dải lý tưởng (${vpdOptMin} - ${vpdOptMax} kPa) của ${cropContext.crop.name}.`,
        level: 'success',
        confidence: 96,
        recommendation: 'Môi trường hô hấp hoàn hảo, cây đang hấp thu dinh dưỡng và CO2 với tốc độ cao nhất.',
        createdAt: now,
      });
    } else if (vpd < 0.4) {
      insights.push({
        id: 'vpd-low',
        title: 'Đình trệ thoát hơi nước (Nguy cơ nấm)',
        description: `VPD ${vpd} kPa quá thấp do không khí ẩm bão hòa (${airH}%). Nước đọng mặt lá dễ phát sinh nấm.`,
        level: 'warning',
        confidence: 87,
        recommendation: 'Tạm ngưng bơm tưới, mở rèm lưới để đón gió tự nhiên làm khô thoáng lá.',
        createdAt: now,
      });
    } else if (vpd > 1.4) {
      insights.push({
        id: 'vpd-high',
        title: 'Áp lực bốc hơi nước cao',
        description: `VPD ${vpd} kPa cao hơn ngưỡng (${vpdOptMax} kPa), cây có xu hướng co cụm khí khổng để tránh mất nước.`,
        level: 'warning',
        confidence: 89,
        recommendation: 'Bật bơm tưới giữ ẩm bầu rễ, tưới ướt lối đi nhà màng để hạ nhiệt tự nhiên.',
        createdAt: now,
      });
    }
  }

  // Logic Ánh sáng (BH1750) & Tích phân quang hợp DLI chuyên sâu cho Dưa lưới
  const lightOptMin = cropContext?.stage.light.optimalMin ?? 20000;
  if (light < lightOptMin) {
    insights.push({
      id: 'light-dli-deficit',
      title: 'Thiếu sáng, thâm hụt quang hợp DLI',
      description: `Cường độ sáng đo được ${light} lx (ngưỡng tối ưu: ${lightOptMin} lx). Thiếu năng lượng quang hợp sẽ làm giảm độ ngọt Brix và chậm hình thành vân lưới.`,
      level: 'warning',
      confidence: 90,
      recommendation: 'Kích hoạt đèn LED quang hợp bổ sung 3-4 giờ để bù đắp tích phân ánh sáng (DLI).',
      createdAt: now,
    });
  }

  // Logic nhiệt độ
  if (temp > tempOptMax + 3) {
    insights.push({
      id: 'temp-high',
      title: `Nhiệt độ vượt chuẩn ${cropName}`,
      description: `Nhiệt độ đo được ${temp}°C cao hơn ngưỡng thích hợp (${tempOptMax}°C).`,
      level: 'warning',
      confidence: 85,
      recommendation: 'Kéo lưới che bớt nắng và mở rèm lưới đón gió tự nhiên.',
      createdAt: now,
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'all-optimal',
      title: `Môi trường chuẩn vàng cho ${cropName}`,
      description: `Tất cả chỉ số (Nhiệt: ${temp}°C, Ẩm KK: ${airH}%, Đất: ${soilH}%) đều đáp ứng hoàn hảo tiêu chuẩn giống.`,
      level: 'success',
      confidence: 95,
      recommendation: 'Duy trì quan trắc và chế độ chăm sóc hiện tại.',
      createdAt: now,
    });
  }

  return insights;
}

// Hàm điều phối chính (Cascade Failover: Gemini -> Groq -> Local)
export async function analyzeAgricultureData(
  sensors: SensorReading[],
  weather?: OutdoorWeather,
  cropContext?: PrecisionCropContext
): Promise<AIAnalysisResult> {
  const now = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

  // Tuyệt đối không suy đoán khi chưa có dữ liệu cảm biến thực tế từ phần cứng
  if (!sensors || sensors.length === 0) {
    return {
      insights: [
        {
          id: 'awaiting_hardware',
          title: 'Đang đợi dữ liệu cảm biến thực tế',
          description: `Hệ thống AI đã ngắt hoàn toàn dữ liệu giả định và đang đợi kết nối từ ESP32 để chẩn đoán cho cây ${cropContext?.crop.name || 'Dưa Lưới'} (${cropContext?.stage.name || 'Chuyên Canh'}).`,
          level: 'info',
          confidence: 100,
          recommendation: 'Hãy cấp nguồn cho ESP32 ngoài vườn. Ngay khi có số đo thực tế, AI sẽ tự động phân tích.',
          createdAt: 'Chờ kết nối',
        },
      ],
      provider: 'local',
      providerName: 'Chờ phần cứng',
      weather,
      timestamp: now,
    };
  }

  const prompt = buildPrompt(sensors, weather, cropContext);

  // 1. Thử Gemini trước
  try {
    const geminiInsights = await callGemini(prompt);
    return {
      insights: geminiInsights,
      provider: 'gemini',
      providerName: 'Gemini AI',
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
      providerName: 'Groq Cloud',
      weather,
      timestamp: now,
    };
  } catch (groqError) {
    console.warn('Groq lỗi, chuyển sang Hệ chuyên gia cục bộ:', (groqError as Error).message);
  }

  // 3. Fallback sang Hệ chuyên gia nông học cục bộ
  const localInsights = getLocalHeuristicInsights(sensors, weather, cropContext);
  return {
    insights: localInsights,
    provider: 'local',
    providerName: 'Chuyên gia Offline',
    weather,
    timestamp: now,
  };
}
