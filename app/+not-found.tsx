import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Không tìm thấy trang' }} />
      <View style={styles.container}>
        <Text style={styles.text}>Trang này không tồn tại.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Về màn hình chính</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  text: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.md,
  },
  link: {
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  linkText: {
    ...typography.body,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
