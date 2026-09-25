import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Power } from 'lucide-react-native';
import type { DeviceState } from '@/types';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';

interface ControlButtonProps {
  device: DeviceState;
  onToggle: (isOn: boolean) => void;
  loading?: boolean;
  icon?: typeof Power;
  accentColor?: string;
}

function ControlButtonComponent({
  device,
  onToggle,
  loading = false,
  icon: Icon = Power,
  accentColor = colors.primary[400],
}: ControlButtonProps) {
  const { isOn } = device;
  const progress = useSharedValue(isOn ? 1 : 0);
  const scale = useSharedValue(1);

  progress.value = withTiming(isOn ? 1 : 0, { duration: 280 });

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['#FFFFFF', accentColor],
    ),
    borderColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.border, accentColor],
    ),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 52 }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.6,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98);
  };
  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <Pressable
      onPress={() => !loading && onToggle(!isOn)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={loading}
    >
      <Animated.View style={[styles.card, trackStyle, { transform: [{ scale: scale.value }] }]}>
        <View style={styles.topRow}>
          <View style={[styles.iconWrap, { backgroundColor: isOn ? 'rgba(255,255,255,0.22)' : 'rgba(30,45,36,0.05)' }]}>
            <Icon size={26} color={isOn ? '#FFFFFF' : colors.textMuted} strokeWidth={2.2} />
          </View>
          <View style={[styles.statusBadge, isOn ? styles.badgeOn : styles.badgeOff]}>
            <View style={[styles.badgeDot, { backgroundColor: isOn ? '#FFFFFF' : colors.textMuted }]} />
            <Text style={[styles.badgeText, { color: isOn ? '#FFFFFF' : colors.textMuted }]}>
              {loading ? 'Đang xử lý' : isOn ? 'Đang chạy' : 'Đang tắt'}
            </Text>
          </View>
        </View>

        <View style={styles.body}>
          <Text style={[styles.label, { color: isOn ? '#FFFFFF' : colors.text }]}>{device.label}</Text>
          <Text style={[styles.subLabel, { color: isOn ? 'rgba(255,255,255,0.85)' : colors.textMuted }]}>
            Relay · {isOn ? 'Mạch đóng' : 'Mạch mở'}
          </Text>
        </View>

        <View style={styles.toggleRow}>
          <Text style={[styles.toggleText, { color: isOn ? '#FFFFFF' : colors.textMuted }]}>
            {isOn ? 'BẬT' : 'TẮT'}
          </Text>
          <View style={[styles.toggleTrack, { backgroundColor: isOn ? 'rgba(0,0,0,0.20)' : 'rgba(30,45,36,0.08)' }]}>
            <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none" />
            <Animated.View style={[styles.knob, knobStyle]} />
          </View>
          {loading && <ActivityIndicator size="small" color={isOn ? '#FFFFFF' : colors.primary[500]} style={styles.loader} />}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const ControlButton = memo(ControlButtonComponent);
export default ControlButton;

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
    ...shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    gap: spacing.xs,
  },
  badgeOn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  badgeOff: {
    backgroundColor: 'rgba(30,45,36,0.06)',
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '700',
  },
  body: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.h2,
    marginBottom: spacing.xs,
  },
  subLabel: {
    ...typography.bodySm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleText: {
    ...typography.h3,
    fontWeight: '700',
    letterSpacing: 1,
  },
  toggleTrack: {
    width: 76,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    padding: 4,
  },
  glow: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 68,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  knob: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1A2E22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  loader: {
    position: 'absolute',
    right: 0,
  },
});
