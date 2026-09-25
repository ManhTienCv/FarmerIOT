import React, { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Wind, Activity, Info, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react-native';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { calculateVPD, getVPDStatus } from '@/utils/agronomy';
import { useCrop } from '@/context/CropContext';

interface VPDCardProps {
  temperature: number; // °C
  humidity: number;    // %
}

function VPDCardComponent({ temperature, humidity }: VPDCardProps) {
  const { selectedCrop, currentStage } = useCrop();

  const vpd = calculateVPD(temperature, humidity);
  const statusInfo = getVPDStatus(vpd, currentStage.vpd);

  // Vị trí con trỏ trên thanh đo 0 kPa đến 2.0 kPa
  const maxScale = 2.0;
  const markerPos = Math.min(Math.max((vpd / maxScale) * 100, 0), 100);

  // Vùng tối ưu của cây hiện tại
  const optMin = currentStage.vpd?.optimalMin ?? 0.8;
  const optMax = currentStage.vpd?.optimalMax ?? 1.2;
  const optLeft = Math.min(Math.max((optMin / maxScale) * 100, 0), 100);
  const optWidth = Math.min(Math.max(((optMax - optMin) / maxScale) * 100, 0), 100 - optLeft);

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <View style={styles.iconWrap}>
            <Wind size={20} color={colors.primary[500]} strokeWidth={2.2} />
          </View>
          <View>
            <View style={styles.nameRow}>
              <Text style={styles.title}>Chỉ Số Bốc Thoát Hơi Nước (VPD)</Text>
              <View style={styles.sciPill}>
                <Text style={styles.sciPillText}>Khoa học Nông nghiệp</Text>
              </View>
            </View>
            <Text style={styles.subtitle}>
              Áp suất thâm hụt hơi nước · Đo lường hoạt động khí khổng lá
            </Text>
          </View>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}18` }]}>
          <View style={[styles.statusDot, { backgroundColor: statusInfo.color }]} />
          <Text style={[styles.statusText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      {/* Main Metric Value Row */}
      <View style={styles.valueRow}>
        <View style={styles.numberBox}>
          <Text style={styles.vpdNumber}>{vpd.toFixed(2)}</Text>
          <Text style={styles.vpdUnit}>kPa</Text>
        </View>

        <View style={styles.targetCol}>
          <Text style={styles.targetLabel}>
            Ngưỡng tối ưu {selectedCrop.name} ({currentStage.name}):
          </Text>
          <Text style={styles.targetValue}>
            {optMin.toFixed(2)} - {optMax.toFixed(2)} kPa
          </Text>
        </View>
      </View>

      {/* Segmented Color Spectrum Bar */}
      <View style={styles.gaugeContainer}>
        <View style={styles.gaugeTrack}>
          {/* Vùng tối ưu của cây hiện tại */}
          <View
            style={[
              styles.gaugeOptimalRegion,
              {
                left: `${optLeft}%`,
                width: `${optWidth}%`,
              },
            ]}
          />

          {/* Con trỏ giá trị hiện tại */}
          <View
            style={[
              styles.gaugeMarker,
              {
                left: `${markerPos}%`,
                backgroundColor: statusInfo.color,
              },
            ]}
          />
        </View>

        {/* Labels dưới thang đo */}
        <View style={styles.gaugeLabels}>
          <Text style={styles.gaugeScaleText}>0.0 (Ẩm)</Text>
          <Text style={styles.gaugeScaleCenter}>0.8 - 1.2 (Quang hợp cực đại)</Text>
          <Text style={styles.gaugeScaleText}>2.0+ (Khô)</Text>
        </View>
      </View>

      {/* Giải thích sinh học & Hành động khuyến nghị */}
      <View style={styles.explanationBox}>
        <Text style={styles.descText}>{statusInfo.description}</Text>
        <View style={styles.actionRow}>
          <Sparkles size={14} color={colors.primary[600]} style={{ marginTop: 1 }} />
          <Text style={styles.actionText}>
            <Text style={styles.actionPrefix}>Hành động khuyến nghị: </Text>
            {statusInfo.recommendation}
          </Text>
        </View>
      </View>
    </View>
  );
}

const VPDCard = memo(VPDCardComponent);
export default VPDCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.base,
    ...shadows.soft,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    ...typography.h3,
    fontSize: 15,
    color: colors.text,
  },
  sciPill: {
    backgroundColor: colors.primary[100],
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  sciPillText: {
    fontSize: 9,
    fontFamily: 'Inter-SemiBold',
    color: colors.primary[700],
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
    gap: spacing.xs,
    marginLeft: spacing.xs,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  numberBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  vpdNumber: {
    ...typography.bigNumber,
    color: colors.text,
    fontSize: 36,
  },
  vpdUnit: {
    ...typography.h3,
    color: colors.textMuted,
  },
  targetCol: {
    alignItems: 'flex-end',
  },
  targetLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  targetValue: {
    ...typography.bodySm,
    fontFamily: 'Inter-SemiBold',
    color: colors.primary[600],
    marginTop: 2,
  },
  gaugeContainer: {
    marginBottom: spacing.md,
  },
  gaugeTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(30,45,36,0.06)',
    position: 'relative',
    overflow: 'visible',
  },
  gaugeOptimalRegion: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(45,106,79,0.3)',
    borderRadius: 4,
  },
  gaugeMarker: {
    position: 'absolute',
    top: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    ...shadows.soft,
  },
  gaugeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs + 2,
  },
  gaugeScaleText: {
    fontSize: 10,
    fontFamily: 'Inter-Regular',
    color: colors.textMuted,
  },
  gaugeScaleCenter: {
    fontSize: 10,
    fontFamily: 'Inter-Medium',
    color: colors.primary[600],
  },
  explanationBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs + 2,
  },
  descText: {
    ...typography.bodySm,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.text,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 2,
  },
  actionText: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.primary[800],
    flex: 1,
  },
  actionPrefix: {
    fontFamily: 'Inter-SemiBold',
  },
});
