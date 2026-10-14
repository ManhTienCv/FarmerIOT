import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CloudRain,
  Droplet,
  Sun,
  Activity,
  CloudSun,
  ShieldAlert,
  Sparkles,
  Bell,
  X,
  CheckCircle2,
  AlertTriangle,
  MoonStar,
  CloudMoon,
  CloudLightning,
  MapPin,
  Check,
} from 'lucide-react-native';
import type { SensorReading, SensorType } from '@/types';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import { getSensors, getSensorHistory } from '@/services/api';
import { sensorMeta, getSensorStatus, statusLabel, statusColor } from '@/constants/sensors';
import {
  getOutdoorWeather,
  type OutdoorWeather,
  VIETNAM_FARM_LOCATIONS,
  type FarmLocation,
  getSavedFarmLocation,
  saveFarmLocation,
} from '@/services/weather';
import SensorCard from '@/components/SensorCard';
import SectionHeader from '@/components/SectionHeader';
import MiniChart from '@/components/MiniChart';
import ActiveCropBanner from '@/components/ActiveCropBanner';
import VPDCard from '@/components/VPDCard';
import { useTabVisibility } from '@/context/TabVisibilityContext';
import { useCrop } from '@/context/CropContext';
import {
  connectMqtt,
  subscribeSensors,
  subscribeConnection,
  subscribeHardwareStatus,
} from '@/services/mqttService';

export default function DashboardScreen() {
  const { onScroll } = useTabVisibility();
  const { selectedCrop, currentStage } = useCrop();
  const [sensors, setSensors] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<SensorType>('temperature');
  const [history, setHistory] = useState<{ time: string; value: number }[]>([]);
  const [isMqttOnline, setIsMqttOnline] = useState(false);
  const [isHwOnline, setIsHwOnline] = useState(false);
  const [weather, setWeather] = useState<OutdoorWeather | null>(null);
  const [currentLocation, setCurrentLocation] = useState<FarmLocation>(VIETNAM_FARM_LOCATIONS[0]);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [notifyModalVisible, setNotifyModalVisible] = useState(false);

  const load = useCallback(async (isRefresh = false, loc?: FarmLocation) => {
    if (isRefresh) setRefreshing(true);
    const targetLoc = loc || currentLocation;
    try {
      const [s, h, w] = await Promise.all([
        getSensors(),
        getSensorHistory(selected, 12),
        getOutdoorWeather(targetLoc.latitude, targetLoc.longitude, targetLoc.name).catch(() => null),
      ]);
      setSensors(s);
      setHistory(h);
      if (w) setWeather(w);
    } catch (e) {
      // lỗi mạng – giữ dữ liệu cũ
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selected, currentLocation]);

  // Nạp vị trí vườn dưa lưới đã lưu và cập nhật thời tiết tương ứng
  useEffect(() => {
    getSavedFarmLocation().then((loc) => {
      setCurrentLocation(loc);
      load(false, loc);
    });
  }, []);

  const handleSelectLocation = async (loc: FarmLocation) => {
    setCurrentLocation(loc);
    setIsLocationModalOpen(false);
    await saveFarmLocation(loc);
    load(false, loc);
  };

  // Kết nối MQTT Broker trên HiveMQ Cloud và đăng ký nhận dữ liệu thời gian thực
  useEffect(() => {
    connectMqtt();
    const unsubSensors = subscribeSensors((liveSensors) => {
      setSensors(liveSensors);
      setLoading(false);
    });
    const unsubConn = subscribeConnection((connected) => {
      setIsMqttOnline(connected);
    });
    const unsubHw = subscribeHardwareStatus((online) => {
      setIsHwOnline(online);
      if (!online) {
        setSensors([]);
      }
      setLoading(false);
    });
    return () => {
      unsubSensors();
      unsubConn();
      unsubHw();
    };
  }, []);

  // Tự cập nhật dữ liệu cảm biến định kỳ mỗi 8 giây (dự phòng khi không có MQTT)
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

  if (loading && !weather) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary[400]} />
        <Text style={styles.loadingText}>Đang khởi tạo hệ thống...</Text>
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
          <View style={styles.headerTextGroup}>
            <Text style={styles.greeting}>Nhà Màng Thông Minh</Text>
            <Text style={styles.title}>Vườn Dưa Lưới</Text>
          </View>
          <View style={styles.headerBadges}>
            <View
              style={[
                styles.liveBadge,
                isHwOnline ? styles.cloudOnlineBadge : styles.deviceOfflineBadge,
              ]}
            >
              <View
                style={[
                  styles.liveDot,
                  { backgroundColor: isHwOnline ? '#10B981' : '#9CA3AF' },
                ]}
              />
              <Text
                style={[
                  styles.liveText,
                  { color: isHwOnline ? '#065F46' : '#4B5563' },
                ]}
              >
                {isHwOnline ? 'Thiết bị Online' : 'Thiết bị Offline'}
              </Text>
            </View>

            {/* Logo Chuông Thông Báo */}
            <Pressable
              style={styles.bellBtn}
              onPress={() => setNotifyModalVisible(true)}
              hitSlop={8}
            >
              <Bell size={20} color={colors.text} />
              {alerts.length > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{alerts.length}</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>

        {/* Khung Thông Báo Dự Báo Thời Tiết & Khuyến Nghị Tưới Tự Động */}
        {weather && (
          <View style={styles.weatherBanner}>
            <View style={styles.weatherTopRow}>
              <View style={styles.weatherLeft}>
                <View
                  style={[
                    styles.weatherIconCircle,
                    {
                      backgroundColor:
                        weather.rainProbability >= 60 || weather.condition === 'rainy'
                          ? '#E0F2FE'
                          : weather.condition === 'stormy'
                            ? '#FEF3C7'
                            : !weather.isDay
                              ? '#EEF2FF'
                              : weather.condition === 'sunny'
                                ? '#FEF3C7'
                                : 'rgba(45,106,79,0.1)',
                    },
                  ]}
                >
                  {weather.rainProbability >= 60 || weather.condition === 'rainy' ? (
                    <CloudRain size={20} color={colors.water[500]} strokeWidth={2.2} />
                  ) : weather.condition === 'stormy' ? (
                    <CloudLightning size={20} color="#D97706" strokeWidth={2.2} />
                  ) : !weather.isDay ? (
                    weather.condition === 'clear_night' ? (
                      <MoonStar size={20} color="#6366F1" strokeWidth={2.2} />
                    ) : (
                      <CloudMoon size={20} color="#818CF8" strokeWidth={2.2} />
                    )
                  ) : weather.condition === 'sunny' ? (
                    <Sun size={20} color={colors.sun[500]} strokeWidth={2.2} />
                  ) : (
                    <CloudSun size={20} color={colors.primary[500]} strokeWidth={2.2} />
                  )}
                </View>
                <View style={styles.weatherTextWrap}>
                  <View style={styles.weatherCityRow}>
                    <Pressable
                      style={styles.weatherCityPressable}
                      onPress={() => setIsLocationModalOpen(true)}
                      hitSlop={6}
                    >
                      <MapPin size={13} color={colors.primary[600]} />
                      <Text style={styles.weatherCityText}>{weather.locationName}</Text>
                      <Text style={styles.weatherChangeHint}>(Đổi)</Text>
                    </Pressable>
                    <View
                      style={[
                        styles.weatherBadge,
                        !weather.isDay && styles.weatherBadgeNight,
                      ]}
                    >
                      <Text
                        style={[
                          styles.weatherBadgeText,
                          !weather.isDay && styles.weatherBadgeTextNight,
                        ]}
                      >
                        {weather.temperature}°C · {weather.humidity}% ẩm
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.weatherDesc} numberOfLines={1}>
                    {weather.weatherDescription} · Xác suất mưa: {weather.rainProbability}%
                  </Text>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.irrigationAdvisoryRow,
                weather.rainProbability >= 60
                  ? styles.rainLockBox
                  : !weather.isDay
                    ? styles.nightAdvisoryBox
                    : styles.normalIrrigationBox,
              ]}
            >
              <View style={styles.irrigationIconWrap}>
                {weather.rainProbability >= 60 ? (
                  <ShieldAlert size={14} color="#D97706" />
                ) : !weather.isDay ? (
                  <MoonStar size={14} color="#6366F1" />
                ) : (
                  <Sparkles size={14} color={colors.primary[600]} />
                )}
              </View>
              <Text style={styles.irrigationAdvisoryText}>
                {weather.rainProbability >= 60
                  ? `Dự báo sắp có mưa (${weather.rainProbability}%): Tạm hoãn tưới nước để chống ngập úng, tránh thối gốc dưa.`
                  : !weather.isDay
                    ? `Trời về đêm (${weather.temperature}°C): Cây ngừng quang hợp và chuyển sang hô hấp tích lũy đường. Giữ khô ráo mặt lá, không tưới muộn để phòng ngừa nấm rỉ sắt.`
                    : weather.condition === 'sunny'
                      ? `Trời nắng đẹp: Cây quang hợp tốt, dưa đang tích lũy độ ngọt (Brix) thuận lợi.`
                      : `Thời tiết mát mẻ: Giữ ẩm bầu dưa theo lịch tưới nhỏ giọt đều đặn.`}
              </Text>
            </View>
          </View>
        )}

        {/* Banner Vụ Mùa Chuyên Sâu Theo Cây Trồng */}
        <ActiveCropBanner />

        {/* Hiển thị thông số cảm biến: CHỈ hiển thị khi ESP32 trực tuyến (Online) để tiết kiệm dung lượng */}
        {!isHwOnline ? (
          <View style={styles.waitingCard}>
            <View style={styles.offlineIconCircle}>
              <Activity size={24} color="#6B7280" strokeWidth={2.2} />
            </View>
            <Text style={styles.waitingTitle}>Bộ điều khiển ESP32 đang Ngoại tuyến</Text>
            <Text style={styles.waitingDesc}>
              Hệ thống đã tự động ẩn toàn bộ thông số môi trường để tránh lưu trữ sai lệch và tiết kiệm dung lượng. Khi bạn cắm nguồn cho ESP32 ngoài vườn, các thông số cảm biến thời gian thực sẽ tự động xuất hiện.
            </Text>
            <View style={styles.waitingStatusRow}>
              <View
                style={[
                  styles.waitingStatusDot,
                  { backgroundColor: isMqttOnline ? '#10B981' : '#F59E0B' },
                ]}
              />
              <Text style={styles.waitingStatusText}>
                {isMqttOnline
                  ? 'Cloud Broker sẵn sàng · Đang chờ ESP32 kết nối...'
                  : 'Đang kết nối lại Cloud Broker...'}
              </Text>
            </View>
          </View>
        ) : (
          <>
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
            {sensors.length === 0 ? (
              <View style={styles.waitingCard}>
                <ActivityIndicator size="small" color={colors.primary[500]} />
                <Text style={styles.waitingTitle}>Đang kết nối nhận dữ liệu từ ESP32</Text>
                <Text style={styles.waitingDesc}>
                  Hệ thống đang đồng bộ gói tin cảm biến thời gian thực đầu tiên từ vườn...
                </Text>
              </View>
            ) : (
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
            )}

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
                    {history.length >= 2 ? (
                      <MiniChart data={history} color={selectedMeta.color} height={140} />
                    ) : (
                      <View style={styles.chartEmpty}>
                        <Text style={styles.chartEmptyText}>
                          {history.length === 1
                            ? 'Đã ghi nhận 1 điểm đo. Cần thêm dữ liệu theo thời gian để vẽ đường cong...'
                            : 'Đang tích lũy các điểm đo thực tế từ cảm biến...'}
                        </Text>
                      </View>
                    )}
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
          </>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>

      {/* Notification Modal */}
      <Modal
        visible={notifyModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNotifyModalVisible(false)}
      >
        <Pressable
          style={styles.notifyModalOverlay}
          onPress={() => setNotifyModalVisible(false)}
        >
          <Pressable style={styles.notifyModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.notifyModalHeader}>
              <View style={styles.notifyHeaderTitleRow}>
                <Bell size={20} color={colors.primary[600]} />
                <Text style={styles.notifyModalTitle}>Thông Báo & Khuyến Nghị</Text>
              </View>
              <Pressable
                onPress={() => setNotifyModalVisible(false)}
                style={styles.notifyCloseBtn}
                hitSlop={8}
              >
                <X size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView style={styles.notifyList} showsVerticalScrollIndicator={false}>
              {alerts.length === 0 ? (
                <View style={styles.notifyEmptyBox}>
                  <CheckCircle2 size={36} color={colors.success} />
                  <Text style={styles.notifyEmptyTitle}>Nhà màng ổn định</Text>
                  <Text style={styles.notifyEmptyDesc}>
                    Mọi chỉ số môi trường đều nằm trong ngưỡng tối ưu cho Dưa Lưới ({currentStage.name}).
                  </Text>
                </View>
              ) : (
                alerts.map((s) => {
                  const meta = sensorMeta[s.type];
                  const range = getStageRange(s.type);
                  const optMin = range ? range.optimalMin : s.optimalMin;
                  const optMax = range ? range.optimalMax : s.optimalMax;
                  const status = getSensorStatus(s.value, optMin, optMax);
                  const Icon = meta.icon;
                  return (
                    <View key={s.type} style={[styles.notifyAlertCard, { borderLeftColor: statusColor[status] }]}>
                      <View style={[styles.notifyAlertIcon, { backgroundColor: `${statusColor[status]}18` }]}>
                        <Icon size={18} color={statusColor[status]} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.notifyRow}>
                          <Text style={styles.notifySensorName}>{meta.label}</Text>
                          <Text style={[styles.notifyStatusTag, { color: statusColor[status] }]}>
                            {status === 'low' ? 'Thấp hơn chuẩn' : 'Cao hơn chuẩn'}
                          </Text>
                        </View>
                        <Text style={styles.notifyDetail}>
                          Hiện tại: <Text style={{ fontWeight: '700' }}>{s.value.toFixed(meta.decimals)}{meta.unit}</Text> (Chuẩn: {optMin} - {optMax}{meta.unit})
                        </Text>
                        <Text style={styles.notifyAdvice}>
                          💡 {status === 'low'
                            ? (s.type === 'soilMoisture' ? 'Nên bật bơm tưới nước bù ẩm cho bầu giá thể.' : s.type === 'light' ? 'Nên bật đèn quang hợp để thúc đẩy sinh trưởng.' : 'Mở rèm lưới đón nắng ấm tự nhiên.')
                            : (s.type === 'temperature' ? 'Kéo lưới che bớt nắng hoặc tưới ướt lối đi để hạ nhiệt.' : s.type === 'soilMoisture' ? 'Tạm ngưng tưới để tránh nứt thân / ngập úng.' : 'Mở rèm lưới để nhà màng thông thoáng tự nhiên.')}
                        </Text>
                      </View>
                    </View>
                  );
                })
              )}

              {weather && weather.rainProbability >= 60 && (
                <View style={styles.notifyWeatherBox}>
                  <CloudRain size={20} color={colors.water[500]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.notifyWeatherTitle}>Thời tiết có mưa ({weather.rainProbability}%)</Text>
                    <Text style={styles.notifyWeatherDesc}>
                      Hệ thống tự động điều chỉnh chu kỳ tưới để tránh thừa ẩm trong bầu rễ.
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal Chọn Khu Vực Nông Trại Thời Tiết */}
      <Modal
        visible={isLocationModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsLocationModalOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setIsLocationModalOpen(false)}
        >
          <Pressable style={styles.locationModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.locationModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs + 2, flex: 1 }}>
                <MapPin size={20} color={colors.primary[600]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.locationModalTitle}>Chọn Khu Vực Nông Trại</Text>
                  <Text style={styles.locationModalSubtitle}>
                    Open-Meteo tự động dự báo thời tiết theo tọa độ từng địa phương
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => setIsLocationModalOpen(false)}
                style={styles.modalCloseBtn}
                hitSlop={8}
              >
                <X size={18} color={colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={{ maxHeight: 380 }}
              showsVerticalScrollIndicator={true}
            >
              {VIETNAM_FARM_LOCATIONS.map((loc) => {
                const isSelected = currentLocation.id === loc.id;
                return (
                  <Pressable
                    key={loc.id}
                    style={[
                      styles.locationItem,
                      isSelected && styles.locationItemActive,
                    ]}
                    onPress={() => handleSelectLocation(loc)}
                  >
                    <View style={styles.locationItemLeft}>
                      <Text style={[styles.locationItemName, isSelected && styles.locationItemNameActive]}>
                        {loc.name}
                      </Text>
                      <Text style={styles.locationItemRegion}>{loc.region}</Text>
                    </View>
                    {isSelected && (
                      <Check size={18} color={colors.primary[600]} strokeWidth={2.5} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>

            <View style={styles.locationModalFooter}>
              <Text style={styles.locationFooterNote}>
                💡 API Open-Meteo hoàn toàn miễn phí, không cần đăng ký API key và tự động đồng bộ nhiệt ẩm theo thời gian thực.
              </Text>
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
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  headerTextGroup: {
    flexShrink: 1,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
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
  cloudOnlineBadge: { backgroundColor: 'rgba(16,185,129,0.12)' },
  cloudOfflineBadge: { backgroundColor: 'rgba(245,158,11,0.12)' },
  deviceOfflineBadge: { backgroundColor: 'rgba(156,163,175,0.16)' },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveText: {
    ...typography.caption,
    fontWeight: '700',
  },
  weatherBanner: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.base,
    ...shadows.soft,
  },
  weatherTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs + 4,
  },
  weatherLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    flex: 1,
  },
  weatherIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(45,106,79,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weatherTextWrap: {
    flex: 1,
  },
  weatherCityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  weatherCityText: {
    fontSize: 13,
    fontFamily: 'Inter-Bold',
    color: colors.text,
  },
  weatherBadge: {
    backgroundColor: 'rgba(45,106,79,0.10)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.pill,
  },
  weatherBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: colors.primary[700],
  },
  weatherDesc: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: colors.textMuted,
  },
  irrigationAdvisoryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    gap: spacing.xs + 3,
    borderWidth: 1,
  },
  normalIrrigationBox: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[200],
  },
  rainLockBox: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  irrigationIconWrap: {
    marginTop: 1,
  },
  irrigationAdvisoryText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: colors.text,
    lineHeight: 16,
    flex: 1,
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
  waitingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...shadows.soft,
    marginVertical: spacing.md,
  },
  waitingTitle: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
    textAlign: 'center',
  },
  waitingDesc: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  offlineIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  waitingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  waitingStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  waitingStatusText: {
    ...typography.caption,
    color: colors.textMuted,
    fontFamily: 'Inter-Medium',
  },
  chartEmpty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartEmptyText: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  bellBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    ...shadows.soft,
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter-Bold',
  },
  notifyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  notifyModalContent: {
    width: '100%',
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.base,
    ...shadows.card,
  },
  notifyModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.md,
  },
  notifyHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  notifyModalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  notifyCloseBtn: {
    padding: spacing.xs,
  },
  notifyList: {
    maxHeight: 400,
  },
  notifyEmptyBox: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  notifyEmptyTitle: {
    ...typography.h3,
    color: colors.success,
  },
  notifyEmptyDesc: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.md,
  },
  notifyAlertCard: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 3,
    gap: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  notifyAlertIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  notifySensorName: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  notifyStatusTag: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
  },
  notifyDetail: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: 4,
  },
  notifyAdvice: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: colors.primary[700],
    lineHeight: 16,
  },
  notifyWeatherBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: radius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  notifyWeatherTitle: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: colors.water[600],
    marginBottom: 2,
  },
  notifyWeatherDesc: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: colors.textMuted,
    lineHeight: 16,
  },
  nightAdvisoryBox: {
    backgroundColor: '#EEF2FF',
    borderColor: '#C7D2FE',
  },
  weatherCityPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  weatherChangeHint: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: colors.primary[600],
    textDecorationLine: 'underline',
  },
  weatherBadgeNight: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
  },
  weatherBadgeTextNight: {
    color: '#4F46E5',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.base,
  },
  locationModalContent: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  locationModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: spacing.xs,
  },
  locationModalTitle: {
    fontSize: 15,
    fontFamily: 'Inter-Bold',
    color: colors.text,
  },
  locationModalSubtitle: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: colors.textMuted,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  locationItemActive: {
    backgroundColor: 'rgba(45, 106, 79, 0.08)',
  },
  locationItemLeft: {
    flex: 1,
  },
  locationItemName: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
    marginBottom: 2,
  },
  locationItemNameActive: {
    color: colors.primary[700],
    fontFamily: 'Inter-Bold',
  },
  locationItemRegion: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: colors.textMuted,
  },
  locationModalFooter: {
    marginTop: spacing.sm,
    paddingTop: spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  locationFooterNote: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: colors.textMuted,
    lineHeight: 16,
  },
});

