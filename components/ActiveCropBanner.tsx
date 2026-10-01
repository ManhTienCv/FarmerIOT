import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  Layers,
  Sparkles,
  Calendar,
  Info,
  SlidersHorizontal,
  Plus,
  Minus,
} from 'lucide-react-native';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { useCrop } from '@/context/CropContext';
import CropSelectorModal from './CropSelectorModal';

interface ActiveCropBannerProps {
  onPressManage?: () => void;
}

export default function ActiveCropBanner({ onPressManage }: ActiveCropBannerProps) {
  const {
    selectedCrop,
    selectedStageIndex,
    currentStage,
    dayOfCrop,
    setStageIndex,
    setDayOfCrop,
  } = useCrop();

  const [modalVisible, setModalVisible] = useState(false);

  const progressPercent = Math.min(
    Math.round((dayOfCrop / (selectedCrop.totalDays || 1)) * 100),
    100,
  );

  return (
    <>
      <View style={styles.card}>
        {/* Top bar: Cây trồng & Nút Đổi cây */}
        <View style={styles.topRow}>
          <View style={styles.cropBadge}>
            <View style={styles.iconCircle}>
              <Text style={styles.cropEmoji}>{selectedCrop.icon}</Text>
            </View>
            <View style={styles.cropInfo}>
              <View style={styles.nameRow}>
                <Text style={styles.cropName} numberOfLines={1}>
                  {selectedCrop.name}
                </Text>
                {selectedCrop.isCustom && (
                  <View style={styles.customPill}>
                    <Sparkles size={10} color={colors.primary[600]} />
                    <Text style={styles.customPillText}>AI</Text>
                  </View>
                )}
              </View>
              <Text style={styles.sciName} numberOfLines={1}>
                {selectedCrop.scientificName}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={() => setModalVisible(true)}
            style={({ pressed }) => [styles.switchBtn, pressed && styles.pressed]}
          >
            <SlidersHorizontal size={14} color={colors.primary[600]} strokeWidth={2.2} />
            <Text style={styles.switchBtnText}>Đổi cây</Text>
          </Pressable>
        </View>

        {/* Thanh tiến độ ngày trồng */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <View style={styles.progressTitleWrap}>
              <Calendar size={13} color={colors.primary[500]} />
              <Text style={styles.progressLabel}>
                Tiến độ: <Text style={styles.progressValue}>Ngày {dayOfCrop}</Text> / {selectedCrop.totalDays} ({progressPercent}%)
              </Text>
            </View>

            <View style={styles.dayControls}>
              <Pressable
                onPress={() => setDayOfCrop(dayOfCrop - 1)}
                style={styles.dayStepBtn}
                hitSlop={8}
              >
                <Minus size={12} color={colors.textMuted} />
              </Pressable>
              <Pressable
                onPress={() => setDayOfCrop(dayOfCrop + 1)}
                style={styles.dayStepBtn}
                hitSlop={8}
              >
                <Plus size={12} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressBar, { width: `${progressPercent}%` }]} />
          </View>
        </View>

        {/* Danh sách giai đoạn sinh trưởng (Stage Chips) */}
        <View style={styles.stagesWrap}>
          <View style={styles.stagesHeader}>
            <Layers size={13} color={colors.textMuted} />
            <Text style={styles.stagesTitle}>Giai đoạn sinh trưởng:</Text>
          </View>

          <View style={styles.stageChipsRow}>
            {selectedCrop.stages.map((stage, idx) => {
              const isActive = selectedStageIndex === idx;
              return (
                <Pressable
                  key={stage.stageId || idx}
                  onPress={() => setStageIndex(idx)}
                  style={[
                    styles.stageChip,
                    isActive && styles.stageChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.stageChipText,
                      isActive && styles.stageChipTextActive,
                    ]}
                  >
                    {idx + 1}. {stage.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Lời khuyên kỹ thuật nông học cho giai đoạn hiện tại */}
        {currentStage.advisoryNote && (
          <View style={styles.advisoryBox}>
            <Info size={14} color={colors.primary[600]} style={{ marginTop: 2 }} />
            <Text style={styles.advisoryText} numberOfLines={3}>
              <Text style={styles.advisoryPrefix}>Lưu ý ({currentStage.daysRange}): </Text>
              {currentStage.advisoryNote}
            </Text>
          </View>
        )}
      </View>

      {/* Modal tìm kiếm & chọn cây trồng E-Commerce */}
      <CropSelectorModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

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
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cropBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: spacing.sm,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary[200],
    marginRight: spacing.md,
  },
  cropEmoji: {
    fontSize: 22,
  },
  cropInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cropName: {
    ...typography.h3,
    color: colors.text,
  },
  customPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[100],
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.pill,
    gap: 2,
  },
  customPillText: {
    fontSize: 9,
    fontFamily: 'Inter-Bold',
    color: colors.primary[700],
  },
  sciName: {
    ...typography.caption,
    fontStyle: 'italic',
    color: colors.textMuted,
    marginTop: 1,
  },
  switchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 5,
  },
  switchBtnText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: colors.primary[600],
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  progressSection: {
    backgroundColor: colors.surfaceAlt,
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 2,
  },
  progressTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: colors.textMuted,
  },
  progressValue: {
    color: colors.primary[600],
    fontFamily: 'Inter-Bold',
  },
  dayControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dayStepBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(30,45,36,0.08)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: colors.primary[500],
    borderRadius: 3,
  },
  stagesWrap: {
    marginBottom: spacing.sm,
  },
  stagesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: spacing.xs + 2,
  },
  stagesTitle: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stageChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
  },
  stageChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  stageChipActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[600],
  },
  stageChipText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: colors.textMuted,
  },
  stageChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  advisoryBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary[50],
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    gap: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.primary[100],
  },
  advisoryText: {
    fontSize: 11,
    color: colors.text,
    lineHeight: 16,
    flex: 1,
  },
  advisoryPrefix: {
    fontFamily: 'Inter-SemiBold',
    color: colors.primary[700],
  },
});
