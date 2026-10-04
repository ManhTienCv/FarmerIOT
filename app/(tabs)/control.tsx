import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Timer,
  Sparkles,
  Info,
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
  subscribeSensors,
  sendMqttDeviceCommand,
  sendMqttModeCommand,
  sendMqttRainLock,
  sendMqttSchedules,
} from '@/services/mqttService';

export interface IrrigationSchedule {
  id: string;
  time: string; // "HH:mm" e.g. "07:00"
  durationMinutes: number;
  days: number[]; // 0 = CN, 1 = T2, ..., 6 = T7
  isEnabled: boolean;
  label: string;
  note?: string;
  stagePreset?: 'seedling' | 'vegetative' | 'fruiting' | 'ripening' | 'custom';
}

export interface MelonPreset {
  id: 'seedling' | 'vegetative' | 'fruiting' | 'ripening';
  stageName: string;
  daysSpan: string;
  badge: string;
  description: string;
  schedules: Omit<IrrigationSchedule, 'id'>[];
}

export const MELON_SCHEDULE_PRESETS: MelonPreset[] = [
  {
    id: 'seedling',
    stageName: 'GĐ 1: Cây con',
    daysSpan: 'Ngày 1 - 15',
    badge: '2 ca · 4 phút/ngày',
    description: 'Tưới sáng 07:00 (2p) & chiều 16:00 (2p) giữ ẩm nhẹ cho bầu ươm',
    schedules: [
      {
        time: '07:00',
        durationMinutes: 2,
        days: [1, 2, 3, 4, 5, 6, 0],
        isEnabled: true,
        label: 'Tưới sáng cây con',
        note: 'Độ ẩm rễ mục tiêu 60-65%',
        stagePreset: 'seedling',
      },
      {
        time: '16:00',
        durationMinutes: 2,
        days: [1, 2, 3, 4, 5, 6, 0],
        isEnabled: true,
        label: 'Tưới chiều mát',
        note: 'Cấp ẩm nhẹ trước khi tắt nắng',
        stagePreset: 'seedling',
      },
    ],
  },
  {
    id: 'vegetative',
    stageName: 'GĐ 2: Thân lá & Leo giàn',
    daysSpan: 'Ngày 16 - 35',
    badge: '3 ca · 8 phút/ngày',
    description: 'Tưới 07:00 (3p), dặm trưa 11:30 (2p) & chiều 16:30 (3p) cấp nước sinh khối',
    schedules: [
      {
        time: '07:00',
        durationMinutes: 3,
        days: [1, 2, 3, 4, 5, 6, 0],
        isEnabled: true,
        label: 'Tưới sáng thân lá',
        note: 'Nhu cầu nước sinh khối',
        stagePreset: 'vegetative',
      },
      {
        time: '11:30',
        durationMinutes: 2,
        days: [1, 2, 3, 4, 5, 6, 0],
        isEnabled: true,
        label: 'Tưới dặm trưa nắng',
        note: 'Hạ nhiệt bầu rễ và giữ ẩm trưa',
        stagePreset: 'vegetative',
      },
      {
        time: '16:30',
        durationMinutes: 3,
        days: [1, 2, 3, 4, 5, 6, 0],
        isEnabled: true,
        label: 'Tưới chiều mát',
        note: 'Chuẩn bị dinh dưỡng đêm',
        stagePreset: 'vegetative',
      },
    ],
  },
  {
    id: 'fruiting',
    stageName: 'GĐ 3: Nuôi trái & Phình quả',
    daysSpan: 'Ngày 36 - 55',
    badge: '4 ca · 12 phút/ngày',
    description: 'Chia nhỏ 4 ca (07h, 10h, 13h30, 16h30) chống sốc nước nứt vỏ trái',
    schedules: [
      {
        time: '07:00',
        durationMinutes: 3,
        days: [1, 2, 3, 4, 5, 6, 0],
        isEnabled: true,
        label: 'Tưới sáng nuôi trái',
        note: 'Nhu cầu nước cao nhất',
        stagePreset: 'fruiting',
      },
      {
        time: '10:00',
        durationMinutes: 3,
        days: [1, 2, 3, 4, 5, 6, 0],
        isEnabled: true,
        label: 'Tưới tăng trưởng sáng',
        note: 'Cấp nước trước đỉnh nắng trưa',
        stagePreset: 'fruiting',
      },
      {
        time: '13:30',
        durationMinutes: 3,
        days: [1, 2, 3, 4, 5, 6, 0],
        isEnabled: true,
        label: 'Tưới dặm đầu chiều',
        note: 'Hạ nhiệt bầu xơ dừa',
        stagePreset: 'fruiting',
      },
      {
        time: '16:30',
        durationMinutes: 3,
        days: [1, 2, 3, 4, 5, 6, 0],
        isEnabled: true,
        label: 'Tưới chiều mát',
        note: 'Tích lũy khoáng nuôi quả',
        stagePreset: 'fruiting',
      },
    ],
  },
  {
    id: 'ripening',
    stageName: 'GĐ 4: Lên lưới & Tích đường',
    daysSpan: 'Ngày 56 - 75',
    badge: '2 ca · 3 phút/ngày',
    description: 'Xiết nước 07:00 (2p) & 15:30 (1p) tạo vân lưới nổi đẹp, ngọt Brix cao',
    schedules: [
      {
        time: '07:00',
        durationMinutes: 2,
        days: [1, 2, 3, 4, 5, 6, 0],
        isEnabled: true,
        label: 'Tưới sáng xiết nước',
        note: 'Giảm nước để tăng độ Brix',
        stagePreset: 'ripening',
      },
      {
        time: '15:30',
        durationMinutes: 1,
        days: [1, 2, 3, 4, 5, 6, 0],
        isEnabled: true,
        label: 'Tưới nhấp chiều',
        note: 'Giữ ẩm tối thiểu chống héo rụng',
        stagePreset: 'ripening',
      },
    ],
  },
];

const STORAGE_KEY_SCHEDULES = '@aiot_irrigation_schedules';
const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

const DEFAULT_SCHEDULES: IrrigationSchedule[] = [];

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

  // Quản lý Lịch tưới & Đồng bộ cảm biến
  const [schedules, setSchedules] = useState<IrrigationSchedule[]>(DEFAULT_SCHEDULES);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);
  const [currentSoilMoisture, setCurrentSoilMoisture] = useState<number>(0);
  const [formLabel, setFormLabel] = useState('Tưới nhỏ giọt');
  const [formHour, setFormHour] = useState('07');
  const [formMinute, setFormMinute] = useState('00');
  const [formDuration, setFormDuration] = useState(3);
  const [formDays, setFormDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 0]);
  const [formNote, setFormNote] = useState('');
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
      sendMqttSchedules(newSchedules);
    } catch (e) {
      console.error('Lỗi lưu lịch tưới:', e);
    }
  };

  // Tính toán ca tưới kế tiếp trong ngày và đếm ngược thời gian
  const nextScheduleInfo = useMemo(() => {
    if (!schedules.length) return null;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const currentDay = now.getDay();

    const enabledSchedules = schedules.filter((s) => s.isEnabled && s.days.includes(currentDay));

    const sortFn = (a: IrrigationSchedule, b: IrrigationSchedule) => {
      const [ah, am] = a.time.split(':').map(Number);
      const [bh, bm] = b.time.split(':').map(Number);
      return ah * 60 + am - (bh * 60 + bm);
    };

    if (enabledSchedules.length > 0) {
      const sortedToday = [...enabledSchedules].sort(sortFn);
      const nextToday = sortedToday.find((s) => {
        const [h, m] = s.time.split(':').map(Number);
        return h * 60 + m > currentMinutes;
      });

      if (nextToday) {
        const [nh, nm] = nextToday.time.split(':').map(Number);
        const diff = nh * 60 + nm - currentMinutes;
        return {
          schedule: nextToday,
          isToday: true,
          diffMinutes: diff,
        };
      }
    }

    // Nếu không còn ca nào hôm nay, lấy ca sớm nhất tiếp theo
    const allEnabled = schedules.filter((s) => s.isEnabled);
    if (!allEnabled.length) return null;
    const sortedAll = [...allEnabled].sort(sortFn);
    return {
      schedule: sortedAll[0],
      isToday: false,
      diffMinutes: null,
    };
  }, [schedules]);

  // Vòng lặp kiểm tra lịch tưới mỗi 15s (chỉ chạy khi ở chế độ TỰ ĐỘNG)
  useEffect(() => {
    const checkSchedule = async () => {
      // Khi ở chế độ THỦ CÔNG hoặc chưa có lịch nào, ngắt mọi can thiệp tự động
      if (operatingMode !== 'auto') return;
      if (!schedules || schedules.length === 0) return;

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

        // KIỂM TRA KHÓA AN TOÀN TRƯỚC KHI TƯỚI:
        // 1. Khóa do dự báo thời tiết có mưa >= 60%
        if (weather && weather.rainProbability >= 60) {
          console.log(`[LỊCH TƯỚI] Tự động hoãn ca "${matched.label}" do dự báo mưa (${weather.rainProbability}%)`);
          return;
        }

        // 2. Khóa do độ ẩm đất đã đủ ẩm (>= 65%)
        if (currentSoilMoisture >= 65) {
          console.log(`[LỊCH TƯỚI] Tự động hoãn ca "${matched.label}" do đất đã đủ ẩm (${currentSoilMoisture}%)`);
          return;
        }

        try {
          // GỬI DUY NHẤT 1 LỆNH MQTT KÈM THỜI LƯỢNG CHO ESP32 TỰ ĐỘNG NGẮT TẠI CHỖ
          const durationSec = matched.durationMinutes * 60;
          await sendMqttDeviceCommand('pump', true, durationSec);
          console.log(`[LỊCH TƯỚI] Đã kích hoạt ca tưới "${matched.label}" (${matched.durationMinutes} phút) qua MQTT`);
        } catch (err) {
          console.error('[LỊCH TƯỚI] Lỗi kích hoạt bơm:', err);
        }
      }
    };

    const interval = setInterval(checkSchedule, 15000);
    return () => clearInterval(interval);
  }, [schedules, operatingMode, weather, currentSoilMoisture]);

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
    const unsubSensors = subscribeSensors((readings) => {
      const soil = readings.find((s) => s.type === 'soilMoisture');
      if (soil && typeof soil.value === 'number') {
        setCurrentSoilMoisture(soil.value);
      }
    });
    return () => {
      unsubDevices();
      unsubConn();
      unsubSensors();
    };
  }, []);

  // Đồng bộ khóa trời mưa và danh sách lịch tưới xuống ESP32 khi kết nối MQTT
  useEffect(() => {
    if (isMqttOnline && weather) {
      const isRainLikely = weather.rainProbability >= 60;
      sendMqttRainLock(isRainLikely);
    }
    if (isMqttOnline && schedules.length > 0) {
      sendMqttSchedules(schedules);
    }
  }, [isMqttOnline, weather, schedules.length]);

  const handleToggle = useCallback(async (type: DeviceType, isOn: boolean) => {
    // Thuật toán Smart Override giải quyết xung đột Tự động vs Nút bấm tay
    if (operatingMode === 'auto') {
      const overrideExp = new Date(Date.now() + 30 * 60 * 1000); // Khóa tự động trong 30 phút
      setOverrideUntil(overrideExp);
    }

    setToggling(type);
    try {
      // Chuẩn hóa 1 kênh duy nhất qua MQTT (kèm thời lượng tối đa 5 phút an toàn cho bơm)
      const durationSec = (type === 'pump' && isOn) ? 300 : 0;
      const sent = await sendMqttDeviceCommand(type, isOn, durationSec);
      if (!sent) {
        // Fallback REST khi chưa kết nối MQTT
        const updated = await toggleDevice(type, isOn);
        setDevices((prev) => prev.map((d) => (d.type === type ? updated : d)));
      }
    } catch (e: any) {
      Alert.alert(
        'Lỗi điều khiển thiết bị',
        e.message || 'Không thể gửi lệnh đến thiết bị.',
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

  const handleClearAllSchedules = () => {
    Alert.alert(
      'Xóa toàn bộ lịch tưới?',
      'Bạn có muốn xóa hết tất cả lịch hẹn giờ? Khi không có lịch, máy bơm sẽ luôn ở trạng thái NGHỈ an toàn và không bao giờ tự động bật.',
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa hết',
          style: 'destructive',
          onPress: () => saveSchedules([]),
        },
      ]
    );
  };

  const handleApplyPreset = (preset: MelonPreset, replaceAll: boolean = true) => {
    const newItems: IrrigationSchedule[] = preset.schedules.map((s, idx) => ({
      ...s,
      id: `sched-${preset.id}-${Date.now()}-${idx}`,
    }));
    const updated = replaceAll ? newItems : [...schedules, ...newItems];
    saveSchedules(updated);
    setIsPresetModalOpen(false);
    Alert.alert(
      'Đã nạp mẫu Dưa Lưới',
      `Đã áp dụng mẫu "${preset.stageName}" gồm ${newItems.length} ca tưới chuẩn kỹ thuật.`
    );
  };

  const handleSaveScheduleForm = () => {
    const newSchedule: IrrigationSchedule = {
      id: `sched-${Date.now()}`,
      time: `${formHour.padStart(2, '0')}:${formMinute.padStart(2, '0')}`,
      durationMinutes: formDuration,
      days: formDays.length > 0 ? formDays : [1, 2, 3, 4, 5, 6, 0],
      isEnabled: true,
      label: formLabel.trim() || 'Tưới nước',
      note: formNote.trim(),
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
              ? 'Tự động: Tưới theo Lịch hẹn giờ. Bơm chỉ bật khi có lịch được kích hoạt.'
              : 'Thủ công: Điều khiển bằng nút bấm. Khóa mọi lịch tưới tự động.'}
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
        {/* Lịch tưới tự động */}
        <View style={styles.scheduleHeaderRow}>
          <View style={{ flex: 1 }}>
            <SectionHeader title="Lịch tưới tự động" subtitle="Hẹn giờ bơm nước theo tuần / tháng" />
          </View>
          <View style={styles.scheduleActionBtns}>
            {schedules.length > 0 && (
              <Pressable
                style={styles.clearAllSchedulesBtn}
                onPress={handleClearAllSchedules}
                hitSlop={8}
              >
                <Trash2 size={13} color={colors.danger} />
                <Text style={styles.clearAllSchedulesBtnText}>Xóa hết</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.melonPresetBtn}
              onPress={() => setIsPresetModalOpen(true)}
              hitSlop={8}
            >
              <Sparkles size={13} color={colors.primary[700]} strokeWidth={2.4} />
              <Text style={styles.melonPresetBtnText}>Mẫu Dưa Lưới</Text>
            </Pressable>
            <Pressable
              style={styles.addScheduleBtn}
              onPress={() => setIsScheduleModalOpen(true)}
              hitSlop={8}
            >
              <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
              <Text style={styles.addScheduleBtnText}>Đặt Lịch</Text>
            </Pressable>
          </View>
        </View>

        {/* Banner Ca tưới kế tiếp & Điều kiện an toàn */}
        {nextScheduleInfo && (
          <View style={styles.nextScheduleCard}>
            <View style={styles.nextScheduleTop}>
              <View style={styles.nextScheduleLabelRow}>
                <Timer size={16} color={colors.primary[600]} strokeWidth={2.4} />
                <Text style={styles.nextScheduleTitle}>Ca tưới kế tiếp</Text>
              </View>
              <View
                style={[
                  styles.nextScheduleBadge,
                  operatingMode !== 'auto'
                    ? styles.nextScheduleBadgePaused
                    : weather && weather.rainProbability >= 60
                    ? styles.nextScheduleBadgeRain
                    : currentSoilMoisture >= 65
                    ? styles.nextScheduleBadgeSoil
                    : styles.nextScheduleBadgeReady,
                ]}
              >
                <Text
                  style={[
                    styles.nextScheduleBadgeText,
                    operatingMode !== 'auto'
                      ? styles.nextScheduleBadgeTextPaused
                      : weather && weather.rainProbability >= 60
                      ? styles.nextScheduleBadgeTextRain
                      : currentSoilMoisture >= 65
                      ? styles.nextScheduleBadgeTextSoil
                      : styles.nextScheduleBadgeTextReady,
                  ]}
                >
                  {operatingMode !== 'auto'
                    ? 'Tạm dừng (Thủ công)'
                    : weather && weather.rainProbability >= 60
                    ? `Hoãn do mưa (${weather.rainProbability}%)`
                    : currentSoilMoisture >= 65
                    ? `Hoãn do đất ẩm (${currentSoilMoisture}%)`
                    : 'Sẵn sàng tự động'}
                </Text>
              </View>
            </View>

            <View style={styles.nextScheduleBottom}>
              <View style={styles.nextScheduleTimePill}>
                <Text style={styles.nextScheduleTimeText}>{nextScheduleInfo.schedule.time}</Text>
              </View>
              <View style={styles.nextScheduleDetails}>
                <Text style={styles.nextScheduleName} numberOfLines={1}>
                  {nextScheduleInfo.schedule.label} ({nextScheduleInfo.schedule.durationMinutes} phút)
                </Text>
                <Text style={styles.nextScheduleCountdown}>
                  {nextScheduleInfo.isToday && nextScheduleInfo.diffMinutes !== null
                    ? nextScheduleInfo.diffMinutes > 60
                      ? `Còn khoảng ${Math.floor(nextScheduleInfo.diffMinutes / 60)} giờ ${nextScheduleInfo.diffMinutes % 60} phút nữa`
                      : `Còn ${nextScheduleInfo.diffMinutes} phút nữa sẽ kích hoạt`
                    : 'Ca tưới sớm nhất của ngày mai'}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.scheduleListWrap}>
          {schedules.length === 0 ? (
            <View style={styles.scheduleEmptyBox}>
              <Clock size={28} color={colors.textMuted} />
              <Text style={styles.scheduleEmptyTitle}>Chưa có lịch tưới nào</Text>
              <Text style={styles.scheduleEmptyText}>
                Máy bơm đang ở trạng thái NGHỈ và KHÔNG tự động bật cho đến khi bạn tạo lịch hoặc nạp Mẫu Dưa Lưới.
              </Text>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={styles.scheduleLabel} numberOfLines={1}>{item.label}</Text>
                      {item.stagePreset && (
                        <View style={styles.stageTag}>
                          <Text style={styles.stageTagText}>
                            {item.stagePreset === 'seedling' ? 'Cây con'
                              : item.stagePreset === 'vegetative' ? 'Thân lá'
                              : item.stagePreset === 'fruiting' ? 'Nuôi trái'
                              : item.stagePreset === 'ripening' ? 'Lên lưới'
                              : 'Chuẩn'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.scheduleSub} numberOfLines={1}>
                      Tưới {item.durationMinutes} phút · {item.days.length === 7 ? 'Mỗi ngày' : item.days.map((d) => DAY_LABELS[d]).join(', ')}
                    </Text>
                    {item.note ? (
                      <Text style={styles.scheduleNoteText} numberOfLines={1}>
                        💡 {item.note}
                      </Text>
                    ) : null}
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

      {/* Modal Đặt Lịch Tưới Tùy Chỉnh */}
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

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              {/* Tên ca tưới */}
              <Text style={styles.fieldLabel}>Tên ca tưới</Text>
              <TextInput
                style={styles.textInput}
                value={formLabel}
                onChangeText={setFormLabel}
                placeholder="VD: Tưới sáng nhỏ giọt"
                placeholderTextColor={colors.textMuted}
              />
              {/* Gợi ý tên nhanh */}
              <View style={[styles.chipRow, { marginTop: 6 }]}>
                {['Tưới sáng', 'Tưới dặm trưa', 'Tưới chiều mát', 'Tưới dinh dưỡng', 'Tưới nhỏ giọt'].map((name) => (
                  <Pressable
                    key={name}
                    onPress={() => setFormLabel(name)}
                    style={[styles.quickNameChip, formLabel === name && styles.quickNameChipActive]}
                  >
                    <Text style={[styles.quickNameChipText, formLabel === name && styles.quickNameChipTextActive]}>
                      {name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Giờ tưới */}
              <Text style={styles.fieldLabel}>Thời gian bắt đầu</Text>
              <View style={styles.timeSelectRow}>
                <View style={styles.timeCol}>
                  <Text style={styles.timeSubLabel}>Giờ</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {['05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20'].map((h) => (
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

              <View style={[styles.timeSelectRow, { marginTop: spacing.xs + 2 }]}>
                <View style={styles.timeCol}>
                  <Text style={styles.timeSubLabel}>Phút</Text>
                  <View style={styles.chipRow}>
                    {['00', '10', '15', '20', '30', '45'].map((m) => (
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
                {[1, 2, 3, 5, 8, 10, 15].map((dur) => (
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
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm }}>
                <Text style={[styles.fieldLabel, { marginTop: 0 }]}>Lặp lại trong tuần</Text>
                <View style={{ flexDirection: 'row', gap: 4 }}>
                  <Pressable
                    onPress={() => setFormDays([1, 2, 3, 4, 5, 6, 0])}
                    style={styles.repeatQuickBtn}
                  >
                    <Text style={styles.repeatQuickText}>Cả tuần</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setFormDays([1, 2, 3, 4, 5])}
                    style={styles.repeatQuickBtn}
                  >
                    <Text style={styles.repeatQuickText}>T2 - T6</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setFormDays([6, 0])}
                    style={styles.repeatQuickBtn}
                  >
                    <Text style={styles.repeatQuickText}>Cuối tuần</Text>
                  </Pressable>
                </View>
              </View>

              <View style={[styles.chipRow, { marginTop: 6 }]}>
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

              {/* Ghi chú */}
              <Text style={styles.fieldLabel}>Ghi chú (Tùy chọn)</Text>
              <TextInput
                style={styles.textInput}
                value={formNote}
                onChangeText={setFormNote}
                placeholder="VD: Giai đoạn nuôi trái - giữ ẩm đều"
                placeholderTextColor={colors.textMuted}
              />

              {/* Lưu ý an toàn */}
              <View style={styles.scheduleSafetyNote}>
                <Info size={14} color={colors.primary[600]} />
                <Text style={styles.scheduleSafetyNoteText}>
                  ESP32 sẽ tự ngắt bơm chính xác tại chỗ khi hết thời gian. Ca tưới sẽ tự hoãn khi có mưa hoặc đất &ge; 65%.
                </Text>
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

      {/* Modal Mẫu Lịch Dưa Lưới Chuẩn Chuyên Gia */}
      <Modal
        visible={isPresetModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPresetModalOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsPresetModalOpen(false)}
        >
          <Pressable style={[styles.modalContent, { maxHeight: '88%' }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2 }}>
                <Sparkles size={20} color={colors.primary[600]} />
                <Text style={styles.modalTitle}>Mẫu Lịch Dưa Lưới Chuẩn</Text>
              </View>
              <Pressable
                onPress={() => setIsPresetModalOpen(false)}
                style={styles.modalCloseBtn}
                hitSlop={8}
              >
                <X size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 460 }}>
              <Text style={styles.presetIntroText}>
                Chọn giai đoạn sinh trưởng của vườn dưa để tự động nạp gói ca tưới chuẩn chuyên gia nông nghiệp:
              </Text>

              {MELON_SCHEDULE_PRESETS.map((preset) => (
                <View key={preset.id} style={styles.presetCard}>
                  <View style={styles.presetCardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.presetStageName}>{preset.stageName}</Text>
                      <Text style={styles.presetDaysSpan}>{preset.daysSpan}</Text>
                    </View>
                    <View style={styles.presetBadge}>
                      <Text style={styles.presetBadgeText}>{preset.badge}</Text>
                    </View>
                  </View>

                  <Text style={styles.presetDesc}>{preset.description}</Text>

                  {/* Chi tiết ca tưới */}
                  <View style={styles.presetTimeList}>
                    {preset.schedules.map((sc, sidx) => (
                      <View key={sidx} style={styles.presetTimeItem}>
                        <Clock size={12} color={colors.primary[700]} />
                        <Text style={styles.presetTimeItemText}>
                          {sc.time} ({sc.durationMinutes}p) - {sc.label}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.presetActionRow}>
                    <Pressable
                      style={styles.applyPresetBtn}
                      onPress={() => handleApplyPreset(preset, true)}
                    >
                      <Check size={14} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.applyPresetBtnText}>Áp dụng mẫu này</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </ScrollView>

            <View style={[styles.modalActions, { marginTop: spacing.sm }]}>
              <Pressable
                onPress={() => setIsPresetModalOpen(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Đóng</Text>
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
  scheduleEmptyTitle: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: colors.text,
    marginTop: 4,
  },
  scheduleEmptyText: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
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
  scheduleActionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  clearAllSchedulesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.20)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    gap: 3,
  },
  clearAllSchedulesBtnText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: colors.danger,
  },
  melonPresetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(45, 106, 79, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(45, 106, 79, 0.25)',
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    gap: 4,
  },
  melonPresetBtnText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: colors.primary[700],
  },
  nextScheduleCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    ...shadows.soft,
  },
  nextScheduleTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 3,
  },
  nextScheduleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nextScheduleTitle: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: colors.text,
  },
  nextScheduleBadge: {
    paddingHorizontal: spacing.xs + 4,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  nextScheduleBadgeReady: {
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
    borderColor: 'rgba(16, 185, 129, 0.25)',
  },
  nextScheduleBadgeRain: {
    backgroundColor: 'rgba(59, 130, 246, 0.10)',
    borderColor: 'rgba(59, 130, 246, 0.25)',
  },
  nextScheduleBadgeSoil: {
    backgroundColor: 'rgba(245, 158, 11, 0.10)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  nextScheduleBadgePaused: {
    backgroundColor: 'rgba(107, 114, 128, 0.10)',
    borderColor: 'rgba(107, 114, 128, 0.25)',
  },
  nextScheduleBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
  },
  nextScheduleBadgeTextReady: {
    color: colors.primary[700],
  },
  nextScheduleBadgeTextRain: {
    color: colors.water[600],
  },
  nextScheduleBadgeTextSoil: {
    color: '#B45309',
  },
  nextScheduleBadgeTextPaused: {
    color: colors.textMuted,
  },
  nextScheduleBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  nextScheduleTimePill: {
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  nextScheduleTimeText: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: colors.primary[700],
  },
  nextScheduleDetails: {
    flex: 1,
    gap: 2,
  },
  nextScheduleName: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  nextScheduleCountdown: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: colors.textMuted,
  },
  stageTag: {
    backgroundColor: 'rgba(45, 106, 79, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'rgba(45, 106, 79, 0.18)',
  },
  stageTagText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: colors.primary[700],
  },
  scheduleNoteText: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  quickNameChip: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickNameChipActive: {
    backgroundColor: 'rgba(45, 106, 79, 0.12)',
    borderColor: colors.primary[500],
  },
  quickNameChipText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: colors.textMuted,
  },
  quickNameChipTextActive: {
    color: colors.primary[700],
    fontFamily: 'Inter-Bold',
  },
  repeatQuickBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  repeatQuickText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: colors.primary[700],
  },
  scheduleSafetyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: 'rgba(45, 106, 79, 0.06)',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(45, 106, 79, 0.15)',
  },
  scheduleSafetyNoteText: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: colors.textMuted,
    flex: 1,
    lineHeight: 15,
  },
  presetIntroText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 17,
  },
  presetCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  presetCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  presetStageName: {
    fontSize: 14,
    fontFamily: 'Inter-Bold',
    color: colors.text,
  },
  presetDaysSpan: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: colors.textMuted,
  },
  presetBadge: {
    backgroundColor: 'rgba(45, 106, 79, 0.10)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'rgba(45, 106, 79, 0.20)',
  },
  presetBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter-Bold',
    color: colors.primary[700],
  },
  presetDesc: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: colors.textMuted,
    lineHeight: 16,
    marginBottom: spacing.sm,
  },
  presetTimeList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xs + 4,
    gap: 4,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetTimeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presetTimeItemText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: colors.text,
  },
  presetActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  applyPresetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    gap: 6,
  },
  applyPresetBtnText: {
    fontSize: 12,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
});
