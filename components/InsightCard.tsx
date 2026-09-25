import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  AlertTriangle,
  Info,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { AIInsight, AlertLevel } from '@/types';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';

const levelMeta: Record<
  AlertLevel,
  { icon: LucideIcon; color: string; bg: string; label: string }
> = {
  danger: { icon: AlertCircle, color: colors.danger, bg: 'rgba(214,64,69,0.08)', label: 'Nguy hiểm' },
  warning: { icon: AlertTriangle, color: colors.warning, bg: 'rgba(217,130,43,0.08)', label: 'Cảnh báo' },
  success: { icon: CheckCircle2, color: colors.success, bg: 'rgba(45,106,79,0.08)', label: 'Tốt' },
  info: { icon: Info, color: colors.info, bg: 'rgba(46,134,171,0.08)', label: 'Gợi ý' },
};

function InsightCardComponent({ insight }: { insight: AIInsight }) {
  const meta = levelMeta[insight.level];
  const Icon = meta.icon;

  return (
    <View style={[styles.card, { borderLeftColor: meta.color }]}>
      <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
        <Icon size={22} color={meta.color} strokeWidth={2.2} />
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {insight.title}
          </Text>
          {typeof insight.confidence === 'number' && (
            <View style={[styles.confPill, { backgroundColor: meta.bg }]}>
              <Text style={[styles.confText, { color: meta.color }]}>
                {insight.confidence}%
              </Text>
            </View>
          )}
        </View>
        <Text style={styles.description}>{insight.description}</Text>
        <View style={[styles.recBox, { backgroundColor: meta.bg }]}>
          <Text style={[styles.recText, { color: meta.color }]}>
            {insight.recommendation}
          </Text>
        </View>
      </View>
    </View>
  );
}

const InsightCard = memo(InsightCardComponent);
export default InsightCard;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    gap: spacing.md,
    ...shadows.soft,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  content: {
    flex: 1,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  confPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  confText: {
    ...typography.caption,
    fontWeight: '700',
  },
  description: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
  recBox: {
    padding: spacing.sm + 2,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  recText: {
    ...typography.bodySm,
    fontWeight: '600',
  },
});
