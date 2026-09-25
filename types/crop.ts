// Định nghĩa cấu trúc dữ liệu Nông Nghiệp Chính Xác (Precision Agriculture)
// Hỗ trợ theo dõi từng loại cây trồng theo giai đoạn sinh trưởng

export type CropCategory = 'leafy' | 'fruit' | 'herb' | 'flower_root';

export interface StageThresholdRange {
  min: number;
  max: number;
  optimalMin: number;
  optimalMax: number;
}

export interface CropStageConfig {
  stageId: string;
  name: string;        // Tên giai đoạn: "Cây con & Bén rễ", "Phát triển thân lá", "Ra hoa / Đậu quả", "Thu hoạch"
  daysRange: string;   // Ví dụ: "Ngày 1 - 10"
  durationDays: number;// Số ngày trung bình
  temperature: StageThresholdRange; // °C
  airHumidity: StageThresholdRange; // %
  soilMoisture: StageThresholdRange;// %
  light: StageThresholdRange;       // lux
  vpd: StageThresholdRange;         // kPa (Áp suất thâm hụt hơi nước)
  advisoryNote: string;             // Lời khuyên kỹ thuật đặc thù
}

export interface CropProfile {
  id: string;
  name: string;             // Tên tiếng Việt, vd: Cải ngọt cao sản, Cà chua bi F1
  scientificName: string;   // Tên khoa học quốc tế, vd: Brassica integrifolia
  category: CropCategory;   // Phân loại: leafy (rau lá), fruit (quả), herb (gia vị), flower_root (hoa/củ)
  icon: string;             // Emoji đại diện (🥬, 🍅, 🌿, 🍓, v.v.)
  totalDays: number;        // Tổng chu kỳ vụ mùa (ngày)
  difficulty: 'easy' | 'medium' | 'hard'; // Độ khó chăm sóc
  vietnamSeason: string;    // Mùa vụ thích hợp tại VN: "Quanh năm", "Vụ Đông - Xuân", v.v.
  description: string;      // Tóm tắt đặc tính nông học
  waterDemand: 'low' | 'medium' | 'high'; // Nhu cầu nước
  stages: CropStageConfig[];// 3-4 giai đoạn sinh trưởng cụ thể
  isCustom?: boolean;       // Đánh dấu cây do AI sinh ra theo yêu cầu người dùng
}

export interface CropCategoryMeta {
  id: CropCategory;
  name: string;
  icon: string;
  description: string;
}

export const CROP_CATEGORIES: CropCategoryMeta[] = [
  { id: 'leafy', name: 'Rau ăn lá', icon: '🥬', description: 'Cải ngọt, rau muống, xà lách, mồng tơi...' },
  { id: 'fruit', name: 'Cây ăn quả', icon: '🍅', description: 'Cà chua, dưa leo, dưa lưới, dâu tây...' },
  { id: 'herb', name: 'Rau gia vị', icon: '🌿', description: 'Hành lá, húng quế, ngò rí, bạc hà...' },
  { id: 'flower_root', name: 'Hoa & Củ quả', icon: '🌸', description: 'Cà rốt, củ cải đỏ, hồng môn, lan...' },
];
