import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BrainCircuit,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Sparkles,
  RotateCw,
  Zap,
} from 'lucide-react-native';
import type { AIInsight } from '@/types';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { getSensors, getAIAnalysis } from '@/services/api';
import { getOutdoorWeather, type OutdoorWeather } from '@/services/weather';
import InsightCard from '@/components/InsightCard';
import SectionHeader from '@/components/SectionHeader';
import WeatherWidget from '@/components/WeatherWidget';
import ActiveCropBanner from '@/components/ActiveCropBanner';
import VPDCard from '@/components/VPDCard';
import { useTabVisibility } from '@/context/TabVisibilityContext';
import { useCrop } from '@/context/CropContext';
import { calculateVPD } from '@/utils/agronomy';
import type { SensorReading } from '@/types';

export default function AIScreen() {
  const { onScroll } = useTabVisibility();
  const { selectedCrop, currentStage, dayOfCrop } = useCrop();
  const [sensors, setSensors] = useState<SensorReading[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [weather, setWeather] = useState<OutdoorWeather | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [providerInfo, setProviderInfo] = useState<{
    provider: 'gemini' | 'groq' | 'local';
    name: string;
    timestamp: string;
  }>({
    provider: 'local',
    name: 'Khởi tạo hệ thống',
    timestamp: '--:--',
  });

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
      setAnalyzing(true);
    }
    try {
      // 1. Tải đồng thời cảm biến và thời tiết ngoài trời
      const [sensorData, weatherData] = await Promise.all([
        getSensors().catch(() => []),
        getOutdoorWeather().catch(() => null),
      ]);

      if (sensorData && sensorData.length > 0) setSensors(sensorData);
      if (weatherData) setWeather(weatherData);

      const temp = sensorData.find((s) => s.type === 'temperature')?.value ?? 28;
      const airH = sensorData.find((s) => s.type === 'airHumidity')?.value ?? 75;
      const vpd = calculateVPD(temp, airH);

      const precisionContext = {
        crop: selectedCrop,
        stage: currentStage,
        dayOfCrop,
        calculatedVPD: vpd,
      };

      // 2. Chạy phân tích AI lai ghép (Gemini -> Groq -> Local Heuristics) kết hợp bối cảnh cây trồng
      const analysis = await getAIAnalysis(sensorData, weatherData || undefined, precisionContext);
      setInsights(analysis.insights);
      setProviderInfo({
        provider: analysis.provider,
        name: analysis.providerName,
        timestamp: analysis.timestamp,
      });
    } catch (e) {
      console.warn('Lỗi khi tải chẩn đoán AI:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setAnalyzing(false);
    }
  }, [selectedCrop, currentStage, dayOfCrop]);

  useEffect(() => {
    load();
  }, [load]);

  const currentTemp = sensors.find((s) => s.type === 'temperature')?.value ?? 28;
  const currentHumidity = sensors.find((s) => s.type === 'airHumidity')?.value ?? 75;

  const dangerCount = insights.filter((i) => i.level === 'danger').length;
  const warningCount = insights.filter((i) => i.level === 'warning').length;
  const confidentInsights = insights.filter((i) => typeof i.confidence === 'number');
  const avgConfidence = confidentInsights.length
    ? Math.round(
        confidentInsights.reduce((a, b) => a + (b.confidence ?? 0), 0) / confidentInsights.length,
      )
    : 0;

  if (loading && !insights.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary[500]} />
        <Text style={styles.loadingText}>Đang tổng hợp dữ liệu cảm biến & thời tiết...</Text>
      </View>
    );
  }

  // Chọn icon cho nhà cung cấp AI
  const renderProviderBadge = () => {
    const isGemini = providerInfo.provider === 'gemini';
    const isGroq = providerInfo.provider === 'groq';

    return (
      <View
        style={[
          styles.providerBadge,
          isGemini && styles.badgeGemini,
          isGroq && styles.badgeGroq,
        ]}
      >
        {isGemini ? (
          <Sparkles size={14} color={colors.primary[600]} />
        ) : isGroq ? (
          <Zap size={14} color={colors.sun[600]} />
        ) : (
          <ShieldCheck size={14} color={colors.soil[500]} />
        )}
        <Text
          style={[
            styles.providerText,
            isGemini && { color: colors.primary[700] },
            isGroq && { color: colors.sun[600] },
          ]}
          numberOfLines={1}
        >
          {providerInfo.name}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={colors.primary[500]}
            colors={[colors.primary[500]]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Phân tích môi trường & AI</Text>
            <Text style={styles.title}>Chẩn đoán thông minh</Text>
          </View>
          <View style={styles.aiBadge}>
            <BrainCircuit size={20} color={colors.primary[500]} strokeWidth={2.2} />
          </View>
        </View>

        {/* Banner Quản lý Cây Trồng Vụ Mùa */}
        <ActiveCropBanner />

        {/* Chỉ số Bốc Thoát Hơi Nước VPD theo giống cây */}
        <VPDCard temperature={currentTemp} humidity={currentHumidity} />

        {/* Widget thời tiết ngoài trời */}
        <WeatherWidget weather={weather} loading={loading && !weather} />

        {/* 2. Trạng thái nguồn AI & Nút phân tích lại */}
        <View style={styles.statusToolbar}>
          <View style={styles.providerWrap}>
            <Text style={styles.engineLabel}>Động cơ phân tích:</Text>
            {renderProviderBadge()}
          </View>

          <Pressable
            style={[styles.refreshBtn, analyzing && styles.refreshBtnActive]}
            onPress={() => load(true)}
            disabled={analyzing}
          >
            {analyzing ? (
              <ActivityIndicator size="small" color={colors.primary[500]} />
            ) : (
              <RotateCw size={14} color={colors.primary[500]} />
            )}
            <Text style={styles.refreshBtnText}>{analyzing ? 'Đang phân tích...' : 'Phân tích lại'}</Text>
          </Pressable>
        </View>

        {/* 3. Thẻ đánh giá tổng quan */}
        <View style={styles.heroCard}>
          <View style={styles.heroGlow} />
          <View style={styles.heroContent}>
            <View style={styles.heroTop}>
              <View style={styles.heroIconWrap}>
                <Sparkles size={20} color={colors.primary[500]} strokeWidth={2.2} />
              </View>
              <Text style={styles.heroLabel}>Đánh giá tổng quan ({providerInfo.timestamp})</Text>
            </View>
            <Text style={styles.heroStatus}>
              {dangerCount > 0
                ? 'Cần can thiệp ngay'
                : warningCount > 0
                  ? 'Cần theo dõi sát'
                  : 'Hệ sinh thái lý tưởng'}
            </Text>
            <Text style={styles.heroDesc}>
              {dangerCount > 0
                ? `Phát hiện ${dangerCount} rủi ro cao và ${warningCount} cảnh báo nông học cần xử lý.`
                : warningCount > 0
                  ? `Có ${warningCount} chỉ số cần lưu ý, không ảnh hưởng nghiêm trọng tức thì.`
                  : 'Tất cả thông số cảm biến và thời tiết đều ở trạng thái thuận lợi cho cây trồng.'}
            </Text>
          </View>
        </View>

        {/* 4. Thống kê chỉ số */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <AlertTriangle size={18} color={colors.danger} strokeWidth={2.2} />
            <Text style={[styles.statValue, { color: colors.danger }]}>{dangerCount}</Text>
            <Text style={styles.statLabel}>Nguy hiểm</Text>
          </View>
          <View style={styles.statItem}>
            <ShieldCheck size={18} color={colors.warning} strokeWidth={2.2} />
            <Text style={[styles.statValue, { color: colors.warning }]}>{warningCount}</Text>
            <Text style={styles.statLabel}>Cảnh báo</Text>
          </View>
          <View style={styles.statItem}>
            <TrendingUp size={18} color={colors.primary[500]} strokeWidth={2.2} />
            <Text style={[styles.statValue, { color: colors.primary[500] }]}>{avgConfidence}%</Text>
            <Text style={styles.statLabel}>Độ tin cậy</Text>
          </View>
        </View>

        {/* 5. Danh sách thẻ khuyến nghị */}
        <SectionHeader
          title="Khuyến nghị & Hành động"
          subtitle={`${insights.length} giải pháp từ chuyên gia AI`}
        />
        <View style={styles.insightsWrap}>
          {insights.map((insight) => (
            <InsightCard key={insight.id} insight={insight} />
          ))}
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.base,
    paddingBottom: 110,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingText: {
    ...typography.body,
    color: colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  greeting: {
    ...typography.bodySm,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  aiBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: 'rgba(45,106,79,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
    gap: spacing.sm,
  },
  providerWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  engineLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(30, 45, 36, 0.06)',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  badgeGemini: {
    backgroundColor: 'rgba(45, 106, 79, 0.12)',
  },
  badgeGroq: {
    backgroundColor: 'rgba(217, 130, 43, 0.12)',
  },
  providerText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: colors.text,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  refreshBtnActive: {
    opacity: 0.7,
  },
  refreshBtnText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary[500],
  },
  heroCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
    ...shadows.card,
  },
  heroGlow: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(45,106,79,0.06)',
  },
  heroContent: {
    position: 'relative',
    zIndex: 1,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heroIconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(45,106,79,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    ...typography.bodySm,
    color: colors.textMuted,
    fontWeight: '600',
  },
  heroStatus: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  heroDesc: {
    ...typography.bodySm,
    color: colors.textMuted,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadows.soft,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
    flexDirection: 'column',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: 'rgba(45,106,79,0.03)',
  },
  statValue: {
    ...typography.h2,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  insightsWrap: {
    gap: spacing.md,
  },
});
