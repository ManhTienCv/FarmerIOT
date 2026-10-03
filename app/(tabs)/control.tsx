import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Droplets,
  Sun,
  Clock,
  Zap,
  Activity,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  RotateCcw,
  CloudRain,
  Cpu,
  Calendar,
  Plus,
  Trash2,
  Check,
  X,
} from 'lucide-react-native';
import type { DeviceState, DeviceType } from '@/types';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { getDevices, toggleDevice } from '@/services/api';
import { getOutdoorWeather, type OutdoorWeather } from '@/services/weather';
import ControlButton from '@/components/ControlButton';
import SectionHeader from '@/components/SectionHeader';
import { useTabVisibility } from '@/context/TabVisibilityContext';
import {
  connectMqtt,
  subscribeDevices,
  subscribeConnection,
  sendMqttDeviceCommand,
  sendMqttModeCommand,
} from '@/services/mqttService';

export interface IrrigationSchedule {
  id: string;
  time: string; // "HH:mm" e.g. "07:00"
  durationMinutes: number;
  days: number[]; // 0 = CN, 1 = T2, ..., 6 = T7
  isEnabled: boolean;
  label: string;
}

const STORAGE_KEY_SCHEDULES = '@aiot_irrigation_schedules';
const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const DEFAULT_SCHEDULES: IrrigationSchedule[] = [
  {
    id: 'sched-1',
    time: '07:00',
    durationMinutes: 3,
    days: [1, 2, 3, 4, 5, 6, 0],
    isEnabled: true,
    label: 'Tưới sáng nhỏ giọt',
  },
  {
    id: 'sched-2',
    time: '16:30',
    durationMinutes: 3,
    days: [1, 2, 3, 4, 5, 6, 0],
    isEnabled: true,
    label: 'Tưới chiều mát',
  },
];

const deviceConfig: Record<DeviceType, { icon: typeof Droplets; accent: string; desc: string }> = {
  pump: { icon: Droplets, accent: colors.water[500], desc: 'Bơm nước tưới' },
  growLight: { icon: Sun, accent: colors.sun[500], desc: 'Bổ sung ánh sáng' },
};

export default function ControlScreen() {
  const { onScroll } = useTabVisibility();
  const [devices, setDevices] = useState<DeviceState[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<DeviceType | null>(null);
  const [isMqttOnline, setIsMqttOnline] = useState(false);
  const [operatingMode, setOperatingMode] = useState<'auto' | 'manual'>('auto');
  const [overrideUntil, setOverrideUntil] = useState<Date | null>(null);
  const [weather, setWeather] = useState<OutdoorWeather | null>(null);

  // Quản lý Lịch tưới
  const [schedules, setSchedules] = useState<IrrigationSchedule[]>(DEFAULT_SCHEDULES);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [formLabel, setFormLabel] = useState('Tưới nhỏ giọt');
  const [formHour, setFormHour] = useState('07');
  const [formMinute, setFormMinute] = useState('00');
  const [formDuration, setFormDuration] = useState(3);
  const [formDays, setFormDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const lastTriggeredRef = useRef<string>('');

  // Đọc lịch tưới đã lưu từ AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY_SCHEDULES);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSchedules(parsed);
          }
        }
      } catch (e) {
        console.error('Lỗi đọc lịch tưới:', e);
      }
    })();
  }, []);

  const saveSchedules = async (newSchedules: IrrigationSchedule[]) => {
    setSchedules(newSchedules);
    try {
      await AsyncStorage.setItem(STORAGE_KEY_SCHEDULES, JSON.stringify(newSchedules));
    } catch (e) {
      console.error('Lỗi lưu lịch tưới:', e);
    }
  };

  // Vòng lặp kiểm tra lịch tưới mỗi 20s (chỉ chạy khi ở chế độ TỰ ĐỘNG)
  useEffect(() => {
    const checkSchedule = async () => {
      // Khi ở chế độ THỦ CÔNG, ngắt mọi can thiệp tự động (kể cả lịch hẹn giờ)
      if (operatingMode !== 'auto') return;

      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const currentHHmm = `${hh}:${mm}`;
      const currentDay = now.getDay();
      const triggerKey = `${currentHHmm}-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

      if (lastTriggeredRef.current === triggerKey) return;

      const matched = schedules.find(
        (s) => s.isEnabled && s.time === currentHHmm && s.days.includes(currentDay)
      );

      if (matched) {
        lastTriggeredRef.current = triggerKey;
        try {
          await toggleDevice('pump', true);
          await sendMqttDeviceCommand('pump', true);
          setTimeout(async () => {
            await toggleDevice('pump', false);
            await sendMqttDeviceCommand('pump', false);
          }, matched.durationMinutes * 60 * 1000);
        } catch (err) {
          console.error('[LỊCH TƯỚI] Lỗi kích hoạt bơm:', err);
        }
      }
    };

    const interval = setInterval(checkSchedule, 20000);
    return () => clearInterval(interval);
  }, [schedules, operatingMode]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [d, w] = await Promise.all([
        getDevices(),
        getOutdoorWeather().catch(() => null),
      ]);
      setDevices(d);
      if (w) setWeather(w);
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
    // Thuật toán Smart Override giải quyết xung đột Tự động vs Nút bấm tay
    if (operatingMode === 'auto') {
      const overrideExp = new Date(Date.now() + 30 * 60 * 1000); // Khóa tự động trong 30 phút
      setOverrideUntil(overrideExp);
    }

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
  }, [operatingMode]);

  const handleToggleSchedule = (id: string) => {
    const updated = schedules.map((s) => (s.id === id ? { ...s, isEnabled: !s.isEnabled } : s));
    saveSchedules(updated);
  };

  const handleDeleteSchedule = (id: string) => {
    const updated = schedules.filter((s) => s.id !== id);
    saveSchedules(updated);
  };

  const handleSaveScheduleForm = () => {
    const newSchedule: IrrigationSchedule = {
      id: `sched-${Date.now()}`,
      time: `${formHour.padStart(2, '0')}:${formMinute.padStart(2, '0')}`,
      durationMinutes: formDuration,
      days: formDays.length > 0 ? formDays : [1, 2, 3, 4, 5, 6, 0],
      isEnabled: true,
      label: formLabel.trim() || 'Tưới nước',
    };
    saveSchedules([...schedules, newSchedule]);
    setIsScheduleModalOpen(false);
  };

  const handleModeChange = (mode: 'auto' | 'manual') => {
    setOperatingMode(mode);
    if (mode === 'auto') {
      setOverrideUntil(null);
    }
    sendMqttModeCommand(mode);
  };

  const isOverrideActive = Boolean(overrideUntil && overrideUntil.getTime() > Date.now());
  const overrideTimeFormatted = overrideUntil
    ? overrideUntil.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    : '';

  const handleResumeAuto = () => {
    setOverrideUntil(null);
    Alert.alert('Đã khôi phục', 'Hệ thống đã trả lại quyền điều khiển tự động hoàn toàn cho cảm biến và lịch trình.');
  };

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
            <Text style={styles.greeting}>Nhà Màng Thông Minh</Text>
            <Text style={styles.title}>Bảng Điều Khiển</Text>
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
              {isMqttOnline ? 'Cloud' : 'Offline'}
            </Text>
          </View>
        </View>

        {/* Chế độ Vận Hành & Khử Xung Đột */}
        <View style={styles.modeCard}>
          <View style={styles.modeHeader}>
            <View style={styles.modeTitleWrap}>
              <Cpu size={16} color={colors.primary[600]} strokeWidth={2.2} />
              <Text style={styles.modeTitle}>Chế độ vận hành:</Text>
            </View>
            <View style={styles.modeToggleGroup}>
              <Pressable
                onPress={() => handleModeChange('auto')}
                style={[
                  styles.modeBtn,
                  operatingMode === 'auto' && styles.modeBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.modeBtnText,
                    operatingMode === 'auto' && styles.modeBtnTextActive,
                  ]}
                >
                  TỰ ĐỘNG
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleModeChange('manual')}
                style={[
                  styles.modeBtn,
                  operatingMode === 'manual' && styles.modeBtnActive,
                ]}
              >
                <Text
                  style={[
                    styles.modeBtnText,
                    operatingMode === 'manual' && styles.modeBtnTextActive,
                  ]}
                >
                  THỦ CÔNG
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Mô tả ngắn gọn */}
          <Text style={styles.modeDesc}>
            {operatingMode === 'auto'
              ? 'Tự động: Cảm biến & lịch trình chủ động đóng ngắt rơ-le.'
              : 'Thủ công: Rơ-le hoạt động độc lập, tuân thủ 100% nút bấm.'}
          </Text>

          {/* Cảnh báo ghi đè thủ công */}
          {operatingMode === 'auto' && isOverrideActive && (
            <View style={styles.overrideAlertBox}>
              <View style={styles.overrideAlertLeft}>
                <ShieldAlert size={16} color="#D97706" style={{ marginTop: 2 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.overrideAlertTitle}>Ghi đè thủ công</Text>
                  <Text style={styles.overrideAlertDesc}>
                    Tạm hoãn tự động đến <Text style={{ fontWeight: '700' }}>{overrideTimeFormatted}</Text>.
                  </Text>
                </View>
              </View>
              <Pressable onPress={handleResumeAuto} style={styles.resumeAutoBtn}>
                <RotateCcw size={12} color={colors.primary[700]} />
                <Text style={styles.resumeAutoBtnText}>Khôi phục Auto</Text>
              </Pressable>
            </View>
          )}

          {/* Cảnh báo khóa tưới do mưa */}
          {operatingMode === 'auto' && weather && weather.rainProbability >= 60 && (
            <View style={styles.rainLockAlertBox}>
              <CloudRain size={16} color={colors.water[600]} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rainLockTitle}>🌧️ Khóa tưới do mưa ({weather.rainProbability}%)</Text>
                <Text style={styles.rainLockDesc}>
                  Tạm dừng chu kỳ tưới tự động để bảo vệ bầu rễ.
                </Text>
              </View>
            </View>
          )}
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
                {activeCount > 0 ? 'Đang bật' : 'Tất cả đã tắt'}
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
        <SectionHeader title="Thiết bị điều khiển" subtitle="Bơm nước & Đèn quang hợp độc lập" />
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

        {/* Lịch tưới tự động */}
        <View style={styles.scheduleHeaderRow}>
          <View style={{ flex: 1 }}>
            <SectionHeader title="Lịch tưới tự động" subtitle="Hẹn giờ bơm nước theo tuần / tháng" />
          </View>
          <Pressable
            style={styles.addScheduleBtn}
            onPress={() => setIsScheduleModalOpen(true)}
            hitSlop={8}
          >
            <Plus size={15} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.addScheduleBtnText}>Đặt Lịch</Text>
          </Pressable>
        </View>

        <View style={styles.scheduleListWrap}>
          {schedules.length === 0 ? (
            <View style={styles.scheduleEmptyBox}>
              <Clock size={28} color={colors.textMuted} />
              <Text style={styles.scheduleEmptyText}>Chưa có lịch tưới. Nhấn "+ Đặt Lịch" để thêm mới.</Text>
            </View>
          ) : (
            schedules.map((item) => (
              <View key={item.id} style={styles.scheduleCard}>
                <View style={styles.scheduleLeft}>
                  <View style={[styles.scheduleTimeBox, item.isEnabled ? styles.scheduleTimeBoxActive : styles.scheduleTimeBoxDisabled]}>
                    <Text style={[styles.scheduleTimeText, item.isEnabled ? styles.scheduleTimeTextActive : styles.scheduleTimeTextDisabled]}>
                      {item.time}
                    </Text>
                  </View>
                  <View style={styles.scheduleInfo}>
                    <Text style={styles.scheduleLabel} numberOfLines={1}>{item.label}</Text>
                    <Text style={styles.scheduleSub} numberOfLines={1}>
                      Tưới {item.durationMinutes} phút · {item.days.length === 7 ? 'Mỗi ngày' : item.days.map((d) => DAY_LABELS[d]).join(', ')}
                    </Text>
                  </View>
                </View>

                <View style={styles.scheduleRight}>
                  <Switch
                    value={item.isEnabled}
                    onValueChange={() => handleToggleSchedule(item.id)}
                    trackColor={{ false: '#D1D5DB', true: colors.primary[400] }}
                    thumbColor={item.isEnabled ? colors.primary[600] : '#F3F4F6'}
                  />
                  <Pressable
                    onPress={() => handleDeleteSchedule(item.id)}
                    style={styles.scheduleDeleteBtn}
                    hitSlop={8}
                  >
                    <Trash2 size={16} color={colors.danger} />
                  </Pressable>
                </View>
              </View>
            ))
          )}
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
            Hệ thống đồng bộ hai chiều thời gian thực qua HiveMQ Cloud TLS 8883.
          </Text>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Modal Đặt Lịch Tưới */}
      <Modal
        visible={isScheduleModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsScheduleModalOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsScheduleModalOpen(false)}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 }}>
                <Calendar size={20} color={colors.primary[600]} />
                <Text style={styles.modalTitle}>Đặt Lịch Tưới Tự Động</Text>
              </View>
              <Pressable
                onPress={() => setIsScheduleModalOpen(false)}
                style={styles.modalCloseBtn}
                hitSlop={8}
              >
                <X size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {/* Tên lịch */}
              <Text style={styles.fieldLabel}>Tên ca tưới</Text>
              <TextInput
                style={styles.textInput}
                value={formLabel}
                onChangeText={setFormLabel}
                placeholder="VD: Tưới sáng nhỏ giọt"
                placeholderTextColor={colors.textMuted}
              />

              {/* Giờ tưới */}
              <Text style={styles.fieldLabel}>Thời gian bắt đầu</Text>
              <View style={styles.timeSelectRow}>
                <View style={styles.timeCol}>
                  <Text style={styles.timeSubLabel}>Giờ</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {['05', '06', '07', '08', '09', '10', '11', '14', '15', '16', '17', '18'].map((h) => (
                      <Pressable
                        key={h}
                        onPress={() => setFormHour(h)}
                        style={[styles.timeChip, formHour === h && styles.timeChipActive]}
                      >
                        <Text style={[styles.timeChipText, formHour === h && styles.timeChipTextActive]}>{h}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>

              <View style={[styles.timeSelectRow, { marginTop: spacing.xs }]}>
                <View style={styles.timeCol}>
                  <Text style={styles.timeSubLabel}>Phút</Text>
                  <View style={styles.chipRow}>
                    {['00', '15', '30', '45'].map((m) => (
                      <Pressable
                        key={m}
                        onPress={() => setFormMinute(m)}
                        style={[styles.timeChip, formMinute === m && styles.timeChipActive]}
                      >
                        <Text style={[styles.timeChipText, formMinute === m && styles.timeChipTextActive]}>{m}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>

              {/* Thời lượng tưới */}
              <Text style={styles.fieldLabel}>Thời lượng bơm (Phút)</Text>
              <View style={styles.chipRow}>
                {[1, 2, 3, 5, 10, 15].map((dur) => (
                  <Pressable
                    key={dur}
                    onPress={() => setFormDuration(dur)}
                    style={[styles.durChip, formDuration === dur && styles.durChipActive]}
                  >
                    <Text style={[styles.durChipText, formDuration === dur && styles.durChipTextActive]}>
                      {dur} phút
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Ngày lặp lại */}
              <Text style={styles.fieldLabel}>Lặp lại trong tuần</Text>
              <View style={styles.chipRow}>
                {DAY_LABELS.map((dayLabel, idx) => {
                  const isSelected = formDays.includes(idx);
                  return (
                    <Pressable
                      key={dayLabel}
                      onPress={() => {
                        if (isSelected) {
                          setFormDays(formDays.filter((d) => d !== idx));
                        } else {
                          setFormDays([...formDays, idx]);
                        }
                      }}
                      style={[styles.dayChip, isSelected && styles.dayChipActive]}
                    >
                      <Text style={[styles.dayChipText, isSelected && styles.dayChipTextActive]}>
                        {dayLabel}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            {/* Buttons */}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setIsScheduleModalOpen(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Hủy</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveScheduleForm}
                style={styles.modalSaveBtn}
              >
                <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
                <Text style={styles.modalSaveText}>Lưu Lịch</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
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
  modeCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.base,
    ...shadows.soft,
  },
  modeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 3,
  },
  modeTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  modeTitle: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: colors.text,
  },
  modeToggleGroup: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeBtn: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  modeBtnActive: {
    backgroundColor: colors.primary[500],
  },
  modeBtnText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: colors.textMuted,
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  modeDesc: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: colors.textMuted,
    lineHeight: 16,
    marginBottom: spacing.xs + 2,
  },
  overrideAlertBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginTop: spacing.xs,
    gap: spacing.xs + 2,
  },
  overrideAlertLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs + 3,
  },
  overrideAlertTitle: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: '#92400E',
    marginBottom: 2,
  },
  overrideAlertDesc: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#78350F',
    lineHeight: 15,
  },
  resumeAutoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
    gap: 4,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  resumeAutoBtnText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: colors.primary[700],
  },
  rainLockAlertBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.20)',
    marginTop: spacing.xs,
    gap: spacing.xs + 3,
  },
  rainLockTitle: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: colors.water[600],
    marginBottom: 2,
  },
  rainLockDesc: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: colors.text,
    lineHeight: 15,
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
  scheduleHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  addScheduleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    gap: 4,
  },
  addScheduleBtnText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  scheduleListWrap: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  scheduleEmptyBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  scheduleEmptyText: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
  },
  scheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.soft,
  },
  scheduleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  scheduleTimeBox: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleTimeBoxActive: {
    backgroundColor: 'rgba(45, 106, 79, 0.10)',
    borderColor: 'rgba(45, 106, 79, 0.30)',
  },
  scheduleTimeBoxDisabled: {
    backgroundColor: 'rgba(30, 45, 36, 0.05)',
    borderColor: colors.border,
  },
  scheduleTimeText: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  scheduleTimeTextActive: {
    color: colors.primary[700],
  },
  scheduleTimeTextDisabled: {
    color: colors.textMuted,
  },
  scheduleInfo: {
    flex: 1,
    gap: 2,
  },
  scheduleLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
  },
  scheduleSub: {
    ...typography.caption,
    color: colors.textMuted,
  },
  scheduleRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scheduleDeleteBtn: {
    padding: spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  modalContent: {
    width: '100%',
    maxHeight: '85%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.base,
    ...shadows.card,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  modalCloseBtn: {
    padding: spacing.xs,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  textInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: colors.text,
  },
  timeSelectRow: {
    marginTop: 2,
  },
  timeCol: {
    gap: 4,
  },
  timeSubLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: colors.textMuted,
  },
  chipScroll: {
    flexDirection: 'row',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  timeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 6,
  },
  timeChipActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[600],
  },
  timeChipText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: colors.textMuted,
  },
  timeChipTextActive: {
    color: '#FFFFFF',
  },
  durChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  durChipActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[600],
  },
  durChipText: {
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: colors.textMuted,
  },
  durChipTextActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  dayChip: {
    width: 38,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayChipActive: {
    backgroundColor: colors.primary[500],
    borderColor: colors.primary[600],
  },
  dayChipText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: colors.textMuted,
  },
  dayChipTextActive: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalCancelBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  modalCancelText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: colors.textMuted,
  },
  modalSaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.md + 4,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: 6,
  },
  modalSaveText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
});
