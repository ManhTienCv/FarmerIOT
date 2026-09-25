import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CloudRain, Droplet, Sun, Activity } from 'lucide-react-native';
import type { SensorReading, SensorType } from '@/types';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { getSensors, getSensorHistory } from '@/services/api';
import { sensorMeta, getSensorStatus, statusLabel, statusColor } from '@/constants/sensors';
import SensorCard from '@/components/SensorCard';
import SectionHeader from '@/components/SectionHeader';
import MiniChart from '@/components/MiniChart';
import ActiveCropBanner from '@/components/ActiveCropBanner';
import VPDCard from '@/components/VPDCard';
import { useTabVisibility } from '@/context/TabVisibilityContext';
import { useCrop } from '@/context/CropContext';

export default function DashboardScreen() {
  const { onScroll } = useTabVisibility();
  const { selectedCrop, currentStage } = useCrop();
  const [sensors, setSensors] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<SensorType>('temperature');
  const [history, setHistory] = useState<{ time: string; value: number }[]>([]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [s, h] = await Promise.all([
        getSensors(),
        getSensorHistory(selected, 12),
      ]);
      setSensors(s);
      setHistory(h);
    } catch (e) {
      // lỗi mạng – giữ dữ liệu cũ
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selected]);

  useEffect(() => {
    load();
  }, [load]);

  // Tự cập nhật dữ liệu cảm biến định kỳ mỗi 8 giây
  useEffect(() => {
    const id = setInterval(() => {
      load();
    }, 8000);
    return () => clearInterval(id);
  }, [load]);

  const selectedMeta = sensorMeta[selected];
  const selectedReading = sensors.find((s) => s.type === selected);

  const getStageRange = (type: SensorType) => {
    switch (type) {
      case 'temperature':
        return currentStage.temperature;
      case 'airHumidity':
        return currentStage.airHumidity;
      case 'soilMoisture':
        return currentStage.soilMoisture;
      case 'light':
        return currentStage.light;
    }
  };

  const stats = useMemo(() => {
    if (!sensors.length) return null;
    const avg = (t: SensorType) =>
      sensors.find((s) => s.type === t)?.value ?? 0;
    return {
      temp: avg('temperature'),
      air: avg('airHumidity'),
      soil: avg('soilMoisture'),
      light: avg('light'),
    };
  }, [sensors]);

  const alerts = sensors.filter((s) => {
    const range = getStageRange(s.type);
    const optMin = range ? range.optimalMin : s.optimalMin;
    const optMax = range ? range.optimalMax : s.optimalMax;
    return getSensorStatus(s.value, optMin, optMax) !== 'optimal';
  });

  if (loading && !sensors.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary[400]} />
        <Text style={styles.loadingText}>Đang tải dữ liệu cảm biến...</Text>
      </View>
    );
  }

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
            <Text style={styles.greeting}>Nông trại thông minh</Text>
            <Text style={styles.title}>Tổng quan hệ thống</Text>
          </View>
          <View style={[styles.liveBadge, alerts.length > 0 ? styles.liveAlert : styles.liveOk]}>
            <View style={[styles.liveDot, { backgroundColor: alerts.length > 0 ? colors.danger : colors.success }]} />
            <Text style={[styles.liveText, { color: alerts.length > 0 ? colors.danger : colors.success }]}>
              {alerts.length > 0 ? `${alerts.length} cảnh báo` : 'Ổn định'}
            </Text>
          </View>
        </View>

        {/* Banner Vụ Mùa Chuyên Sâu Theo Cây Trồng */}
        <ActiveCropBanner />

        {/* Quick stats */}
        {stats && (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Activity size={16} color={colors.sun[500]} strokeWidth={2.2} />
              <Text style={styles.statValue}>{stats.temp.toFixed(1)}°</Text>
              <Text style={styles.statLabel}>Nhiệt độ</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <CloudRain size={16} color={colors.water[500]} strokeWidth={2.2} />
              <Text style={styles.statValue}>{Math.round(stats.air)}%</Text>
              <Text style={styles.statLabel}>Độ ẩm KK</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Droplet size={16} color={colors.soil[500]} strokeWidth={2.2} />
              <Text style={styles.statValue}>{Math.round(stats.soil)}%</Text>
              <Text style={styles.statLabel}>Độ ẩm đất</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Sun size={16} color={colors.sun[500]} strokeWidth={2.2} />
              <Text style={styles.statValue}>{(stats.light / 1000).toFixed(1)}k</Text>
              <Text style={styles.statLabel}>Ánh sáng</Text>
            </View>
          </View>
        )}

        {/* Thẻ chỉ số VPD Bốc thoát hơi nước & Vùng quang hợp cực đại */}
        {stats && <VPDCard temperature={stats.temp} humidity={stats.air} />}

        {/* Sensor cards grid với ngưỡng động theo cây */}
        <SectionHeader
          title="Cảm biến thời gian thực"
          subtitle={`Ngưỡng chuẩn tối ưu: ${selectedCrop.name} (${currentStage.name})`}
        />
        <View style={styles.grid}>
          {sensors.map((s) => {
            const range = getStageRange(s.type);
            return (
              <View key={s.type} style={styles.gridItem}>
                <SensorCard
                  reading={s}
                  optimalMin={range?.optimalMin}
                  optimalMax={range?.optimalMax}
                  cropTargetName={selectedCrop.name}
                  onPress={() => setSelected(s.type)}
                />
              </View>
            );
          })}
        </View>

        {/* Chart */}
        {selectedReading && (() => {
          const selectedRange = getStageRange(selectedReading.type);
          const selOptMin = selectedRange?.optimalMin ?? selectedReading.optimalMin;
          const selOptMax = selectedRange?.optimalMax ?? selectedReading.optimalMax;
          const selectedStatus = getSensorStatus(selectedReading.value, selOptMin, selOptMax);

          return (
            <>
              <SectionHeader
                title={`Biểu đồ ${selectedMeta.label.toLowerCase()}`}
                subtitle={`Chuẩn ${selectedCrop.name}: ${selOptMin} - ${selOptMax} ${selectedMeta.unit}`}
                right={`${selectedReading.value.toFixed(selectedMeta.decimals)} ${selectedMeta.unit}`}
              />
              <View style={styles.chartCard}>
                <View style={styles.chartHeader}>
                  <View style={[styles.chartIcon, { backgroundColor: selectedMeta.bg }]}>
                    {(() => {
                      const Icon = selectedMeta.icon;
                      return <Icon size={18} color={selectedMeta.color} strokeWidth={2.2} />;
                    })()}
                  </View>
                  <Text style={styles.chartLabel}>{selectedMeta.label}</Text>
                  <View style={[styles.chartPill, { backgroundColor: `${statusColor[selectedStatus]}22` }]}>
                    <Text style={[styles.chartPillText, { color: statusColor[selectedStatus] }]}>
                      {statusLabel[selectedStatus]}
                    </Text>
                  </View>
                </View>
                <MiniChart data={history} color={selectedMeta.color} height={140} />
              </View>
            </>
          );
        })()}

        {/* Alerts */}
        {alerts.length > 0 && (
          <>
            <SectionHeader
              title="Cảnh báo đang hoạt động"
              subtitle={`${alerts.length} thông số lệch chuẩn ${selectedCrop.name} (${currentStage.name})`}
            />
            <View style={styles.alertsWrap}>
              {alerts.map((s) => {
                const meta = sensorMeta[s.type];
                const range = getStageRange(s.type);
                const optMin = range ? range.optimalMin : s.optimalMin;
                const optMax = range ? range.optimalMax : s.optimalMax;
                const status = getSensorStatus(s.value, optMin, optMax);
                const Icon = meta.icon;
                return (
                  <View key={s.type} style={[styles.alertItem, { borderLeftColor: statusColor[status] }]}>
                    <View style={[styles.alertIcon, { backgroundColor: `${statusColor[status]}22` }]}>
                      <Icon size={18} color={statusColor[status]} strokeWidth={2.2} />
                    </View>
                    <View style={styles.alertBody}>
                      <Text style={styles.alertTitle}>{meta.label}</Text>
                      <Text style={styles.alertDesc}>
                        {status === 'low'
                          ? `Thấp: ${s.value.toFixed(meta.decimals)}${meta.unit} (chuẩn ${selectedCrop.name}: ${optMin}–${optMax})`
                          : `Cao: ${s.value.toFixed(meta.decimals)}${meta.unit} (chuẩn ${selectedCrop.name}: ${optMin}–${optMax})`}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}

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
    marginBottom: spacing.lg,
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
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    gap: spacing.xs,
  },
  liveOk: { backgroundColor: 'rgba(45,106,79,0.10)' },
  liveAlert: { backgroundColor: 'rgba(214,64,69,0.10)' },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: {
    ...typography.caption,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadows.soft,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  statValue: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  gridItem: {
    width: '48%',
    flexBasis: '48%',
  },
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chartIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
    fontWeight: '600',
  },
  chartPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  chartPillText: {
    ...typography.caption,
    fontWeight: '700',
  },
  alertsWrap: {
    gap: spacing.sm,
  },
  alertItem: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    gap: spacing.md,
    ...shadows.soft,
  },
  alertIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertBody: {
    flex: 1,
    gap: 2,
  },
  alertTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  alertDesc: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
});
