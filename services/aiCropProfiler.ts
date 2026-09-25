// Dịch vụ khởi tạo hồ sơ cây trồng tức thì bằng Trí tuệ Nhân tạo (Gemini 3.6 Flash & Groq)
// Giúp hệ thống hỗ trợ hàng nghìn loại cây trồng khác nhau mà không làm nặng ứng dụng
import type { CropProfile, CropStageConfig, CropCategory } from '@/types/crop';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';
const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';

function buildProfilerPrompt(cropName: string): string {
  return `Bạn là một Chuyên gia Nông học Cấp cao và Kỹ sư Nông nghiệp Công nghệ cao am hiểu sâu sắc thổ nhưỡng, mùa vụ và khí hậu Việt Nam (Bắc Bộ, Trung Bộ, Nam Bộ, Tây Nguyên - Đà Lạt).

Người dùng muốn gieo trồng loại cây sau: "${cropName}".

HÃY XÂY DỰNG BỆNH ÁN SINH HỌC & BẢNG THÔNG SỐ NÔNG NGHIỆP CHÍNH XÁC PHÙ HỢP KHÍ HẬU VIỆT NAM CHO LOẠI CÂY NÀY.
Cần phân chia rõ ràng thành 3 đến 4 giai đoạn sinh trưởng then chốt (Ví dụ: Cây con / Thân lá / Ra hoa / Đậu quả & Thu hoạch).
Mỗi giai đoạn phải có ngưỡng Nhiệt độ (°C), Độ ẩm không khí (%), Độ ẩm đất (%), Ánh sáng (lux), và Áp suất thâm hụt hơi nước VPD (kPa) chuẩn khoa học.

BẮT BUỘC TRẢ VỀ ĐÚNG ĐỊNH DẠNG JSON SAU (không thêm bất kỳ lời dẫn hay markdown nào ngoài JSON):
{
  "name": "${cropName}",
  "scientificName": "Tên khoa học La-tinh chính xác",
  "category": "leafy" | "fruit" | "herb" | "flower_root",
  "icon": "Một emoji phù hợp (ví dụ 🥬, 🍅, 🌿, 🌸, 🍄, 🥕, 🍇)",
  "totalDays": 45,
  "difficulty": "easy" | "medium" | "hard",
  "vietnamSeason": "Khuyến nghị vụ mùa tại Việt Nam (vd: Quanh năm, Vụ Thu Đông, v.v.)",
  "description": "Tóm tắt đặc tính nông học, thời tiết thích nghi trong 1-2 câu",
  "waterDemand": "low" | "medium" | "high",
  "stages": [
    {
      "stageId": "seedling",
      "name": "Cây con & Bén rễ",
      "daysRange": "Ngày 1 - 10",
      "durationDays": 10,
      "temperature": { "min": 20, "max": 30, "optimalMin": 22, "optimalMax": 26 },
      "airHumidity": { "min": 65, "max": 85, "optimalMin": 70, "optimalMax": 80 },
      "soilMoisture": { "min": 60, "max": 80, "optimalMin": 65, "optimalMax": 75 },
      "light": { "min": 5000, "max": 20000, "optimalMin": 8000, "optimalMax": 15000 },
      "vpd": { "min": 0.45, "max": 0.85, "optimalMin": 0.55, "optimalMax": 0.75 },
      "advisoryNote": "Lời khuyên kỹ thuật chăm sóc đắt giá nhất cho giai đoạn này."
    }
  ]
}`;
}

function cleanJsonText(raw: string): string {
  return raw.replace(/```json/gi, '').replace(/```/g, '').trim();
}

// 1. Sinh bằng Google Gemini
async function profileWithGemini(cropName: string): Promise<CropProfile> {
  if (!GEMINI_API_KEY) throw new Error('Chưa có Gemini API Key');

  const prompt = buildProfilerPrompt(cropName);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_API_KEY}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    }),
    signal: AbortSignal.timeout(9000),
  });

  if (!response.ok) {
    throw new Error(`Gemini Crop Profiler error: HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini không phản hồi dữ liệu');

  const parsed = JSON.parse(cleanJsonText(text));
  return formatParsedCrop(parsed, cropName);
}

// 2. Fallback Groq
async function profileWithGroq(cropName: string): Promise<CropProfile> {
  if (!GROQ_API_KEY) throw new Error('Chưa có Groq API Key');

  const prompt = buildProfilerPrompt(cropName);
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
      temperature: 0.2,
    }),
    signal: AbortSignal.timeout(9000),
  });

  if (!response.ok) {
    throw new Error(`Groq Crop Profiler error: HTTP ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq không phản hồi dữ liệu');

  const parsed = JSON.parse(cleanJsonText(text));
  return formatParsedCrop(parsed, cropName);
}

// Chuẩn hóa dữ liệu nhận được từ AI
function formatParsedCrop(raw: any, rawName: string): CropProfile {
  const id = `ai-crop-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const validCategories: CropCategory[] = ['leafy', 'fruit', 'herb', 'flower_root'];
  const category: CropCategory = validCategories.includes(raw.category) ? raw.category : 'leafy';

  const stages: CropStageConfig[] = Array.isArray(raw.stages) && raw.stages.length > 0
    ? raw.stages.map((st: any, idx: number) => ({
        stageId: st.stageId || `stage-${idx + 1}`,
        name: String(st.name || `Giai đoạn ${idx + 1}`),
        daysRange: String(st.daysRange || `Giai đoạn ${idx + 1}`),
        durationDays: Number(st.durationDays) || 15,
        temperature: {
          min: Number(st.temperature?.min ?? 18),
          max: Number(st.temperature?.max ?? 32),
          optimalMin: Number(st.temperature?.optimalMin ?? 22),
          optimalMax: Number(st.temperature?.optimalMax ?? 28),
        },
        airHumidity: {
          min: Number(st.airHumidity?.min ?? 60),
          max: Number(st.airHumidity?.max ?? 85),
          optimalMin: Number(st.airHumidity?.optimalMin ?? 65),
          optimalMax: Number(st.airHumidity?.optimalMax ?? 75),
        },
        soilMoisture: {
          min: Number(st.soilMoisture?.min ?? 55),
          max: Number(st.soilMoisture?.max ?? 80),
          optimalMin: Number(st.soilMoisture?.optimalMin ?? 60),
          optimalMax: Number(st.soilMoisture?.optimalMax ?? 70),
        },
        light: {
          min: Number(st.light?.min ?? 8000),
          max: Number(st.light?.max ?? 45000),
          optimalMin: Number(st.light?.optimalMin ?? 15000),
          optimalMax: Number(st.light?.optimalMax ?? 30000),
        },
        vpd: {
          min: Number(st.vpd?.min ?? 0.6),
          max: Number(st.vpd?.max ?? 1.3),
          optimalMin: Number(st.vpd?.optimalMin ?? 0.8),
          optimalMax: Number(st.vpd?.optimalMax ?? 1.1),
        },
        advisoryNote: String(st.advisoryNote || 'Theo dõi độ ẩm và ánh sáng định kỳ.'),
      }))
    : buildFallbackStages();

  return {
    id,
    name: String(raw.name || rawName),
    scientificName: String(raw.scientificName || `${rawName} sp.`),
    category,
    icon: String(raw.icon || '🌱'),
    totalDays: Number(raw.totalDays) || 50,
    difficulty: (['easy', 'medium', 'hard'].includes(raw.difficulty) ? raw.difficulty : 'medium') as any,
    vietnamSeason: String(raw.vietnamSeason || 'Thích hợp trồng mùa khô ráo hoặc có lưới che'),
    description: String(raw.description || `Hồ sơ nông học chuyên sâu cho cây ${rawName} được tổng hợp bởi AI.`),
    waterDemand: (['low', 'medium', 'high'].includes(raw.waterDemand) ? raw.waterDemand : 'medium') as any,
    stages,
    isCustom: true,
  };
}

// Fallback mẫu khi mất mạng
function buildFallbackProfile(cropName: string): CropProfile {
  return {
    id: `local-crop-${Date.now()}`,
    name: cropName,
    scientificName: `${cropName} sp. (Việt Nam)`,
    category: 'leafy',
    icon: '🌿',
    totalDays: 45,
    difficulty: 'medium',
    vietnamSeason: 'Quanh năm nhiệt đới',
    description: `Hồ sơ nông nghiệp tiêu chuẩn thích ứng khí hậu nhiệt đới cho giống cây ${cropName}.`,
    waterDemand: 'medium',
    stages: buildFallbackStages(),
    isCustom: true,
  };
}

function buildFallbackStages(): CropStageConfig[] {
  return [
    {
      stageId: 'seedling',
      name: 'Cây con & Ươm mầm',
      daysRange: 'Ngày 1 - 10',
      durationDays: 10,
      temperature: { min: 20, max: 30, optimalMin: 22, optimalMax: 26 },
      airHumidity: { min: 70, max: 90, optimalMin: 75, optimalMax: 85 },
      soilMoisture: { min: 65, max: 80, optimalMin: 70, optimalMax: 75 },
      light: { min: 5000, max: 20000, optimalMin: 8000, optimalMax: 15000 },
      vpd: { min: 0.4, max: 0.85, optimalMin: 0.5, optimalMax: 0.75 },
      advisoryNote: 'Giữ ẩm đều mặt đất, che nắng gay gắt buổi trưa.',
    },
    {
      stageId: 'vegetative',
      name: 'Sinh trưởng & Phát triển mạnh',
      daysRange: 'Ngày 11 - 32',
      durationDays: 22,
      temperature: { min: 18, max: 32, optimalMin: 22, optimalMax: 28 },
      airHumidity: { min: 60, max: 80, optimalMin: 65, optimalMax: 75 },
      soilMoisture: { min: 60, max: 75, optimalMin: 65, optimalMax: 70 },
      light: { min: 12000, max: 50000, optimalMin: 20000, optimalMax: 35000 },
      vpd: { min: 0.8, max: 1.3, optimalMin: 0.85, optimalMax: 1.15 },
      advisoryNote: 'Duy trì đủ ánh sáng để lá quang hợp tổng hợp sinh khối tối đa.',
    },
    {
      stageId: 'harvest',
      name: 'Hoàn thiện & Thu hoạch',
      daysRange: 'Ngày 33 - 45',
      durationDays: 13,
      temperature: { min: 18, max: 30, optimalMin: 20, optimalMax: 26 },
      airHumidity: { min: 55, max: 75, optimalMin: 60, optimalMax: 70 },
      soilMoisture: { min: 50, max: 68, optimalMin: 55, optimalMax: 62 },
      light: { min: 10000, max: 40000, optimalMin: 15000, optimalMax: 28000 },
      vpd: { min: 0.85, max: 1.35, optimalMin: 0.9, optimalMax: 1.2 },
      advisoryNote: 'Giảm nhẹ lượng nước tưới trước thu hoạch 2-3 ngày.',
    },
  ];
}

/**
 * Hàm phân tích và tạo hồ sơ nông học tức thì cho cây bất kỳ
 */
export async function generateCropProfileWithAI(cropName: string): Promise<CropProfile> {
  const safeName = cropName.replace(/["\r\n\\]/g, '').trim().slice(0, 60);
  if (!safeName) return buildFallbackProfile('Cây trồng');

  // Thử Gemini trước
  try {
    return await profileWithGemini(safeName);
  } catch (errGemini) {
    console.warn('[AI Crop Profiler] Gemini lỗi, chuyển sang Groq fallback:', errGemini);
  }

  // Fallback Groq
  try {
    return await profileWithGroq(safeName);
  } catch (errGroq) {
    console.warn('[AI Crop Profiler] Groq lỗi, dùng bộ mẫu nông học nội bộ:', errGroq);
  }

  // Fallback nội bộ
  return buildFallbackProfile(safeName);
}
