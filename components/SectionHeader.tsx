import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  right?: string;
}

function SectionHeaderComponent({ title, subtitle, right }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right ? (
        <View style={styles.pill}>
          <Text style={styles.pillText}>{right}</Text>
        </View>
      ) : null}
    </View>
  );
}

const SectionHeader = memo(SectionHeaderComponent);
export default SectionHeader;

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.text,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  pill: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.pill,
  },
  pillText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '600',
  },
});
