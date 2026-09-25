import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';

interface StatPillProps {
  label: string;
  value: string;
  color?: string;
}

function StatPillComponent({ label, value, color = colors.text }: StatPillProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>{value}</Text>
    </View>
  );
}

const StatPill = memo(StatPillComponent);
export default StatPill;

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    ...typography.h3,
    fontWeight: '700',
  },
});
