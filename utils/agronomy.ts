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
        label: 'Ẩm độ quá bão hòa',
        description: 'VPD dưới ngưỡng sinh trưởng của cây. Cây khó thoát hơi nước để vận chuyển canxi.',
        color: colors.water[500],
        recommendation: 'Bật quạt thông gió, ngưng tưới phun sương để giảm ẩm.',
      };
    }
    if (vpd < targetRange.optimalMin) {
      return {
        status: 'seedling',
        label: 'Mát mẻ (Dưới mức tối ưu)',
        description: 'VPD hơi thấp, khí khổng mở một phần. Phù hợp cây con hoặc thời tiết mát.',
        color: colors.accent[500],
        recommendation: 'Tăng nhiệt độ nhẹ hoặc thông thoáng khí trong vườn.',
      };
    }
    if (vpd <= targetRange.optimalMax) {
      return {
        status: 'optimal',
        label: 'Vùng quang hợp cực đại',
        description: 'Khí khổng mở hoàn hảo, tốc độ hút dinh dưỡng và hấp thu CO2 tối ưu nhất cho cây.',
        color: colors.primary[500],
        recommendation: 'Duy trì ổn định môi trường vườn hiện tại.',
      };
    }
    if (vpd <= targetRange.max) {
      return {
        status: 'stress',
        label: 'Áp lực thoát hơi nước tăng',
        description: 'VPD hơi cao so với mức chuẩn. Tốc độ thoát hơi nước tăng nhẹ.',
        color: colors.warning,
        recommendation: 'Kiểm tra độ ẩm đất và che bớt nắng gắt buổi trưa.',
      };
    }
    return {
      status: 'danger_high',
      label: 'Khô hạn sinh lý',
      description: 'VPD quá cao vượt ngưỡng chịu đựng. Khí khổng đóng tự vệ, quang hợp bị đình trệ.',
      color: colors.danger,
      recommendation: 'Kích hoạt phun sương hạ nhiệt và che bớt nắng gắt ngay.',
    };
  }

  // Thang chuẩn quốc tế mặc định
  if (vpd < 0.4) {
    return {
      status: 'danger_low',
      label: 'Đình trệ thoát hơi nước',
      description: 'Không khí quá ẩm ướt (>88%). Đọng nước trên lá làm bùng phát nấm mốc phấn trắng.',
      color: colors.water[500],
      recommendation: 'Tăng cường thông gió, giảm phun sương tạo ẩm trong nhà màng.',
    };
  }
  if (vpd < 0.8) {
    return {
      status: 'seedling',
      label: 'Mát mẻ (Chuẩn cây con)',
      description: 'Môi trường êm dịu, rễ non hút nước nhẹ nhàng, không bị sốc mất nước.',
      color: colors.accent[500],
      recommendation: 'Rất tốt cho ươm mầm, giâm cành hoặc cây trong 10 ngày đầu.',
    };
  }
  if (vpd <= 1.2) {
    return {
      status: 'optimal',
      label: 'Vùng quang hợp cực đại',
      description: 'Transpiration Zone lý tưởng: Cây hô hấp và đồng hóa chất dinh dưỡng đạt năng suất tối đa.',
      color: colors.primary[500],
      recommendation: 'Điều kiện hoàn hảo, cây đang sinh trưởng với tốc độ tốt nhất.',
    };
  }
  if (vpd <= 1.6) {
    return {
      status: 'stress',
      label: 'Mất nước nhẹ (Cần chú ý)',
      description: 'Không khí hơi khô hoặc nhiệt độ cao. Tốc độ thoát hơi nước vượt nhẹ khả năng hút rễ.',
      color: colors.warning,
      recommendation: 'Kiểm tra độ ẩm đất, tưới dặm nhẹ hoặc kéo lưới lan cách nhiệt.',
    };
  }

  return {
    status: 'danger_high',
    label: 'Khô hạn sinh lý cực hạn',
    description: 'VPD quá cao (>1.6 kPa). Cây đóng khí khổng chống bốc hơi nước làm đọt rũ, cháy rìa lá non.',
    color: colors.danger,
    recommendation: 'Bật hệ thống phun sương làm mát và tưới cấp ẩm bù đắp ngay lập tức.',
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
