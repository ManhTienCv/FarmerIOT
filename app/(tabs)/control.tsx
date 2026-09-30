import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Droplets, Sun, Clock, Zap, Activity, CheckCircle2, AlertCircle } from 'lucide-react-native';
import type { DeviceState, DeviceType } from '@/types';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { getDevices, toggleDevice } from '@/services/api';
import ControlButton from '@/components/ControlButton';
import SectionHeader from '@/components/SectionHeader';
import { useTabVisibility } from '@/context/TabVisibilityContext';
import { connectMqtt, subscribeDevices, subscribeConnection } from '@/services/mqttService';

const deviceConfig: Record<DeviceType, { icon: typeof Droplets; accent: string; desc: string }> = {
  pump: { icon: Droplets, accent: colors.water[500], desc: 'Bơm nước tưới cây' },
  growLight: { icon: Sun, accent: colors.sun[500], desc: 'Bổ sung ánh sáng' },
};

export default function ControlScreen() {
  const { onScroll } = useTabVisibility();
  const [devices, setDevices] = useState<DeviceState[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<DeviceType | null>(null);
  const [isMqttOnline, setIsMqttOnline] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const d = await getDevices();
      setDevices(d);
    } catch (e: any) {
      if (isRefresh) {
        Alert.alert('Lỗi kết nối', e.message || 'Không thể lấy trạng thái thiết bị.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Kết nối MQTT Broker trên HiveMQ Cloud và đăng ký nhận trạng thái thiết bị thời gian thực
  useEffect(() => {
    connectMqtt();
    const unsubDevices = subscribeDevices((dev) => {
      setDevices((prev) => {
        if (!prev.length) return [dev];
        const exists = prev.some((d) => d.type === dev.type);
        if (exists) {
          return prev.map((d) => (d.type === dev.type ? dev : d));
        }
        return [...prev, dev];
      });
      setLoading(false);
    });
    const unsubConn = subscribeConnection((connected) => {
      setIsMqttOnline(connected);
    });
    return () => {
      unsubDevices();
      unsubConn();
    };
  }, []);

  const handleToggle = useCallback(async (type: DeviceType, isOn: boolean) => {
    setToggling(type);
    try {
      const updated = await toggleDevice(type, isOn);
      setDevices((prev) => prev.map((d) => (d.type === type ? updated : d)));
    } catch (e: any) {
      Alert.alert(
        'Lỗi điều khiển thiết bị',
        e.message || 'Không thể gửi lệnh đến ESP32. Vui lòng kiểm tra Wi-Fi và IP phần cứng.',
      );
    } finally {
      setToggling(null);
    }
  }, []);

  const activeCount = devices.filter((d) => d.isOn).length;

  if (loading && !devices.length) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary[400]} />
        <Text style={styles.loadingText}>Đang tải trạng thái thiết bị...</Text>
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
            <Text style={styles.greeting}>Điều khiển từ xa</Text>
            <Text style={styles.title}>Bảng điều khiển</Text>
          </View>
          <View
            style={[
              styles.liveBadge,
              isMqttOnline ? styles.cloudOnlineBadge : styles.cloudOfflineBadge,
            ]}
          >
            <View
              style={[
                styles.liveDot,
                { backgroundColor: isMqttOnline ? '#10B981' : '#F59E0B' },
              ]}
            />
            <Text
              style={[
                styles.liveText,
                { color: isMqttOnline ? '#065F46' : '#92400E' },
              ]}
            >
              {isMqttOnline ? 'Cloud MQTT' : 'Mạng nội bộ'}
            </Text>
          </View>
        </View>

        {/* Status summary */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryLeft}>
            <View style={[styles.summaryIcon, activeCount > 0 ? styles.summaryActive : styles.summaryIdle]}>
              <Zap size={22} color={activeCount > 0 ? '#FFFFFF' : colors.textMuted} strokeWidth={2.2} />
            </View>
            <View>
              <Text style={styles.summaryValue}>
                {activeCount}/{devices.length} thiết bị
              </Text>
              <Text style={styles.summaryLabel}>
                {activeCount > 0 ? 'Đang hoạt động' : 'Tất cả đã tắt'}
              </Text>
            </View>
          </View>
          <View style={styles.summaryRight}>
            {devices.map((d) => (
              <View key={d.type} style={styles.summaryDotRow}>
                <View style={[styles.summaryDot, { backgroundColor: d.isOn ? colors.success : colors.textMuted }]} />
                <Text style={styles.summaryDotText}>{d.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Control buttons */}
        <SectionHeader title="Thiết bị điều khiển" subtitle="Giao tiếp qua Relay" />
        <View style={styles.controlsWrap}>
          {devices.map((d) => {
            const cfg = deviceConfig[d.type];
            return (
              <ControlButton
                key={d.type}
                device={d}
                onToggle={(isOn) => handleToggle(d.type, isOn)}
                loading={toggling === d.type}
                icon={cfg.icon}
                accentColor={cfg.accent}
              />
            );
          })}
        </View>

        {/* Activity log */}
        <SectionHeader title="Nhật ký hoạt động" subtitle="Lần bật/tắt gần nhất" />
        <View style={styles.logCard}>
          {devices.map((d, i) => {
            const cfg = deviceConfig[d.type];
            const Icon = d.isOn ? CheckCircle2 : AlertCircle;
            const parsedDate = new Date(d.lastToggledAt);
            const time = !isNaN(parsedDate.getTime())
              ? parsedDate.toLocaleTimeString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : d.lastToggledAt || 'Vừa xong';
            return (
              <View key={d.type} style={[styles.logItem, i < devices.length - 1 && styles.logItemBorder]}>
                <View style={[styles.logIcon, { backgroundColor: d.isOn ? 'rgba(45,106,79,0.12)' : 'rgba(30,45,36,0.05)' }]}>
                  <Icon size={18} color={d.isOn ? colors.success : colors.textMuted} strokeWidth={2.2} />
                </View>
                <View style={styles.logBody}>
                  <Text style={styles.logTitle}>{d.label}</Text>
                  <Text style={styles.logDesc}>
                    {d.isOn ? 'Đã bật' : 'Đã tắt'} · {cfg.desc}
                  </Text>
                </View>
                <View style={styles.logTime}>
                  <Clock size={14} color={colors.textMuted} strokeWidth={2} />
                  <Text style={styles.logTimeText}>{time}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Info note */}
        <View style={styles.infoNote}>
          <Activity size={16} color={colors.primary[400]} strokeWidth={2.2} />
          <Text style={styles.infoText}>
            Trạng thái thiết bị được đồng bộ thời gian thực. Khi bật Backend thật, lệnh sẽ gửi tới Relay qua API nội bộ.
          </Text>
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
  cloudOnlineBadge: { backgroundColor: 'rgba(16,185,129,0.12)' },
  cloudOfflineBadge: { backgroundColor: 'rgba(245,158,11,0.12)' },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: {
    ...typography.caption,
    fontWeight: '700',
  },
  summaryCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    ...shadows.soft,
  },
  summaryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryActive: { backgroundColor: colors.success },
  summaryIdle: { backgroundColor: 'rgba(30,45,36,0.06)' },
  summaryValue: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
  },
  summaryLabel: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
  summaryRight: {
    gap: spacing.xs,
  },
  summaryDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  summaryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  summaryDotText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  controlsWrap: {
    gap: spacing.md,
  },
  logCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  logItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  logIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logBody: {
    flex: 1,
    gap: 2,
  },
  logTitle: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  logDesc: {
    ...typography.bodySm,
    color: colors.textMuted,
  },
  logTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  logTimeText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(45,106,79,0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(45,106,79,0.15)',
  },
  infoText: {
    ...typography.bodySm,
    color: colors.textMuted,
    flex: 1,
  },
});
