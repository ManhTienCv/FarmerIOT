// Tiện ích tính toán chỉ số Nông Học & Bốc Thoát Hơi Nước (VPD - Vapor Pressure Deficit)
import type { CropProfile, CropStageConfig, StageThresholdRange } from '@/types/crop';
import { colors } from '@/constants/theme';

export interface VPDStatusResult {
  status: 'danger_low' | 'seedling' | 'optimal' | 'stress' | 'danger_high';
  label: string;
  description: string;
  color: string;
  recommendation: string;
}

/**
 * Tính Áp Suất Thâm Hụt Hơi Nước (VPD) theo chuẩn Nông Học Quốc Tế
 * @param temp Nhiệt độ không khí (°C)
 * @param relativeHumidity Độ ẩm tương đối (%)
 * @returns VPD tính bằng kiloPascal (kPa)
 */
export function calculateVPD(temp: number, relativeHumidity: number): number {
  if (temp < -20 || relativeHumidity < 0) return 0.8;
  const safeRH = Math.min(Math.max(relativeHumidity, 0), 100);
  // Áp suất hơi bão hòa Tetens: SVP (kPa)
  const svp = 0.61078 * Math.exp((17.27 * temp) / (temp + 237.3));
  // Áp suất thâm hụt: VPD = SVP * (1 - RH / 100)
  const vpd = svp * (1 - safeRH / 100);
  return Number(Math.max(0, vpd).toFixed(2));
}

/**
 * Đánh giá trạng thái sinh lý học của khí khổng qua chỉ số VPD
 */
export function getVPDStatus(vpd: number, targetRange?: StageThresholdRange): VPDStatusResult {
  // Nếu có khoảng tối ưu riêng của cây trồng hiện tại
  if (targetRange) {
    if (vpd < targetRange.min) {
      return {
        status: 'danger_low',
        label: 'Quá ẩm',
        description: 'VPD quá thấp. Khí khổng khó thoát hơi nước để luân chuyển Canxi.',
        color: colors.water[500],
        recommendation: 'Bật thông gió, ngưng tưới phun sương để giảm ẩm.',
      };
    }
    if (vpd < targetRange.optimalMin) {
      return {
        status: 'seedling',
        label: 'Ẩm nhẹ',
        description: 'VPD dưới mức tối ưu, thích hợp giai đoạn cây con hoặc trời mát.',
        color: colors.accent[500],
        recommendation: 'Duy trì thông thoáng khí tự nhiên trong vườn.',
      };
    }
    if (vpd <= targetRange.optimalMax) {
      return {
        status: 'optimal',
        label: 'Tối ưu',
        description: 'Khí khổng mở lý tưởng, quang hợp và hút dinh dưỡng đạt hiệu suất cao nhất.',
        color: colors.primary[500],
        recommendation: 'Duy trì ổn định môi trường hiện tại.',
      };
    }
    if (vpd <= targetRange.max) {
      return {
        status: 'stress',
        label: 'Hơi khô',
        description: 'Áp lực thoát hơi nước tăng nhẹ. Cần chú ý độ ẩm giá thể.',
        color: colors.warning,
        recommendation: 'Kiểm tra độ ẩm đất, che nắng gắt buổi trưa.',
      };
    }
    return {
      status: 'danger_high',
      label: 'Quá khô',
      description: 'VPD vượt ngưỡng an toàn. Cây co khí khổng tự vệ, đình trệ quang hợp.',
      color: colors.danger,
      recommendation: 'Phun sương hạ nhiệt và cấp ẩm ngay.',
    };
  }

  // Thang chuẩn quốc tế mặc định
  if (vpd < 0.4) {
    return {
      status: 'danger_low',
      label: 'Quá ẩm',
      description: 'Không khí bão hòa ẩm. Nước đọng mặt lá dễ phát sinh nấm mốc.',
      color: colors.water[500],
      recommendation: 'Tăng cường thông gió, giảm độ ẩm vườn.',
    };
  }
  if (vpd < 0.8) {
    return {
      status: 'seedling',
      label: 'Ẩm nhẹ',
      description: 'Môi trường êm dịu, phù hợp cây con hoặc giai đoạn bén rễ.',
      color: colors.accent[500],
      recommendation: 'Môi trường rất tốt cho mầm non sinh trưởng.',
    };
  }
  if (vpd <= 1.2) {
    return {
      status: 'optimal',
      label: 'Tối ưu',
      description: 'Vùng quang hợp cực đại: Hô hấp và hấp thu dinh dưỡng tối đa.',
      color: colors.primary[500],
      recommendation: 'Điều kiện lý tưởng, cây phát triển thuận lợi.',
    };
  }
  if (vpd <= 1.6) {
    return {
      status: 'stress',
      label: 'Hơi khô',
      description: 'Tốc độ bốc hơi nước tăng nhanh hơn khả năng hút nước của rễ.',
      color: colors.warning,
      recommendation: 'Tưới dặm ẩm hoặc kéo lưới che bớt nắng gắt.',
    };
  }

  return {
    status: 'danger_high',
    label: 'Quá khô',
    description: 'VPD quá cao (>1.6 kPa). Cây khép khí khổng, nguy cơ héo rũ chóp lá.',
    color: colors.danger,
    recommendation: 'Bật phun sương làm mát và tưới bù ẩm tức thì.',
  };
}

/**
 * Lấy cấu hình giai đoạn hiện tại của cây
 */
export function getCurrentStage(crop: CropProfile, stageIndex: number): CropStageConfig {
  const idx = Math.min(Math.max(0, stageIndex), crop.stages.length - 1);
  return crop.stages[idx] ?? crop.stages[0];
}

/**
 * Tìm kiếm không dấu tiếng Việt cho ô tìm kiếm E-Commerce
 */
export function normalizeVietnamese(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .trim();
}

export function matchesSearchQuery(crop: CropProfile, query: string): boolean {
  if (!query.trim()) return true;
  const cleanQ = normalizeVietnamese(query);
  const nameMatch = normalizeVietnamese(crop.name).includes(cleanQ);
  const sciMatch = normalizeVietnamese(crop.scientificName).includes(cleanQ);
  const descMatch = normalizeVietnamese(crop.description).includes(cleanQ);
  const seasonMatch = normalizeVietnamese(crop.vietnamSeason).includes(cleanQ);
  return nameMatch || sciMatch || descMatch || seasonMatch;
}
