import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { SensorReading } from '@/types';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { sensorMeta, getSensorStatus, statusLabel, statusColor } from '@/constants/sensors';

interface SensorCardProps {
  reading: SensorReading;
  optimalMin?: number;
  optimalMax?: number;
  cropTargetName?: string;
  onPress?: () => void;
}

function SensorCardComponent({
  reading,
  optimalMin,
  optimalMax,
  cropTargetName,
  onPress,
}: SensorCardProps) {
  const meta = sensorMeta[reading.type];
  const targetMin = typeof optimalMin === 'number' ? optimalMin : reading.optimalMin;
  const targetMax = typeof optimalMax === 'number' ? optimalMax : reading.optimalMax;
  const status = getSensorStatus(reading.value, targetMin, targetMax);
  const Icon = meta.icon;
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97);
  };
  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <Pressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
            <Icon size={22} color={meta.color} strokeWidth={2.2} />
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${statusColor[status]}22` }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor[status] }]} />
            <Text style={[styles.statusText, { color: statusColor[status] }]}>
              {statusLabel[status]}
            </Text>
          </View>
        </View>

        <Text style={styles.label} numberOfLines={1}>
          {meta.label}
        </Text>

        <View style={styles.valueRow}>
          <Text style={styles.value}>
            {reading.value.toFixed(meta.decimals)}
          </Text>
          <Text style={styles.unit}>{meta.unit}</Text>
        </View>

        {(() => {
          const span = reading.max - reading.min || 1;
          const optLeft = Math.min(Math.max(((targetMin - reading.min) / span) * 100, 0), 100);
          const optRight = Math.min(Math.max((1 - (targetMax - reading.min) / span) * 100, 0), 100);
          const markerPos = Math.min(Math.max((reading.value - reading.min) / span, 0), 1) * 100;

          return (
            <View style={styles.rangeBar}>
              <View style={styles.rangeTrack}>
                <View
                  style={[
                    styles.rangeOptimal,
                    {
                      left: `${optLeft}%`,
                      right: `${optRight}%`,
                    },
                  ]}
                />
                <View
                  style={[
                    styles.rangeMarker,
                    {
                      left: `${markerPos}%`,
                      backgroundColor: statusColor[status],
                    },
                  ]}
                />
              </View>
            </View>
          );
        })()}

        <View style={styles.footerRow}>
          <Text style={styles.hint} numberOfLines={1}>
            Mục tiêu:{' '}
            <Text style={styles.hintTarget}>
              {targetMin} - {targetMax} {meta.unit}
            </Text>
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const SensorCard = memo(SensorCardComponent);
export default SensorCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
    gap: spacing.xs,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  label: {
    ...typography.bodySm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  value: {
    ...typography.bigNumber,
    color: colors.text,
  },
  unit: {
    ...typography.h3,
    color: colors.textMuted,
    fontWeight: '500',
  },
  rangeBar: {
    marginBottom: spacing.sm,
  },
  rangeTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(30,45,36,0.06)',
    position: 'relative',
  },
  rangeOptimal: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(45,106,79,0.22)',
    borderRadius: 3,
  },
  rangeMarker: {
    position: 'absolute',
    top: -3,
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
  },
  hintTarget: {
    fontFamily: 'Inter-SemiBold',
    color: colors.primary[600],
  },
});
