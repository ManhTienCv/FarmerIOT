import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Sun, Cloud, CloudRain, CloudLightning, Droplets, Wind, Umbrella } from 'lucide-react-native';
import type { OutdoorWeather } from '@/services/weather';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';

interface WeatherWidgetProps {
  weather: OutdoorWeather | null;
  loading?: boolean;
}

function WeatherWidgetComponent({ weather, loading }: WeatherWidgetProps) {
  if (loading || !weather) {
    return (
      <View style={styles.card}>
        <Text style={styles.loadingText}>Đang cập nhật dữ liệu thời tiết ngoài trời...</Text>
      </View>
    );
  }

  const isRainLikely = weather.rainProbability >= 60;

  // Chọn icon phù hợp theo điều kiện
  const renderWeatherIcon = () => {
    switch (weather.condition) {
      case 'sunny':
        return <Sun size={28} color={colors.sun[500]} strokeWidth={2.2} />;
      case 'rainy':
        return <CloudRain size={28} color={colors.water[500]} strokeWidth={2.2} />;
      case 'stormy':
        return <CloudLightning size={28} color={colors.danger} strokeWidth={2.2} />;
      case 'cloudy':
      default:
        return <Cloud size={28} color={colors.textMuted} strokeWidth={2.2} />;
    }
  };

  return (
    <View style={styles.card}>
      {/* Hàng trên: Địa điểm & Giờ cập nhật */}
      <View style={styles.topRow}>
        <View style={styles.locationGroup}>
          <Text style={styles.locationLabel}>Thời tiết thực tế ({weather.locationName})</Text>
          <Text style={styles.conditionText}>{weather.weatherDescription}</Text>
        </View>
        <View style={styles.iconBadge}>
          {renderWeatherIcon()}
        </View>
      </View>

      {/* Hàng giữa: Các chỉ số nhiệt độ, độ ẩm, gió, xác suất mưa */}
      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricValue}>{weather.temperature}°C</Text>
          <Text style={styles.metricLabel}>Nhiệt độ ngoài</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricItem}>
          <View style={styles.inlineIcon}>
            <Droplets size={14} color={colors.water[500]} />
            <Text style={styles.metricValue}>{weather.humidity}%</Text>
          </View>
          <Text style={styles.metricLabel}>Độ ẩm ngoài</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricItem}>
          <View style={styles.inlineIcon}>
            <Umbrella size={14} color={isRainLikely ? colors.water[600] : colors.textMuted} />
            <Text style={[styles.metricValue, isRainLikely && { color: colors.water[600] }]}>
              {weather.rainProbability}%
            </Text>
          </View>
          <Text style={styles.metricLabel}>Khả năng mưa</Text>
        </View>

        <View style={styles.metricDivider} />

        <View style={styles.metricItem}>
          <View style={styles.inlineIcon}>
            <Wind size={14} color={colors.textMuted} />
            <Text style={styles.metricValue}>{weather.windSpeed}</Text>
          </View>
          <Text style={styles.metricLabel}>Gió (km/h)</Text>
        </View>
      </View>

      {/* Chú thích thông minh nếu sắp mưa */}
      {isRainLikely && (
        <View style={styles.rainNotice}>
          <Umbrella size={15} color={colors.primary[600]} />
          <Text style={styles.rainNoticeText}>
            Dự báo hôm nay có mưa lớn. AI sẽ tính toán tạm hoãn tưới để bảo vệ rễ cây.
          </Text>
        </View>
      )}
    </View>
  );
}

const WeatherWidget = memo(WeatherWidgetComponent);
export default WeatherWidget;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.base,
    ...shadows.soft,
  },
  loadingText: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  locationGroup: {
    flex: 1,
  },
  locationLabel: {
    ...typography.caption,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  conditionText: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(45, 106, 79, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(30, 45, 36, 0.03)',
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  metricDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  inlineIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  metricValue: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  metricLabel: {
    fontSize: 10.5,
    color: colors.textMuted,
  },
  rainNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    backgroundColor: 'rgba(45, 106, 79, 0.10)',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    marginTop: spacing.md,
  },
  rainNoticeText: {
    ...typography.caption,
    color: colors.primary[600],
    fontWeight: '600',
    flex: 1,
  },
});
