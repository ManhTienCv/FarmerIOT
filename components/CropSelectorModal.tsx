import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Search,
  X,
  Sparkles,
  Check,
  Calendar,
  Clock,
  Layers,
  Trash2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react-native';
import { colors, radius, shadows, spacing, typography } from '@/constants/theme';
import type { CropProfile, CropCategory } from '@/types/crop';
import { CROP_CATEGORIES } from '@/types/crop';
import { useCrop } from '@/context/CropContext';

interface CropSelectorModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function CropSelectorModal({ visible, onClose }: CropSelectorModalProps) {
  const {
    selectedCrop,
    changeCrop,
    searchCrops,
    generateAndAddCustomCrop,
    deleteCustomCrop,
    isGeneratingAI,
  } = useCrop();

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CropCategory | 'all'>('all');
  const [aiError, setAiError] = useState<string | null>(null);

  const filteredCrops = useMemo(() => {
    return searchCrops(query, selectedCategory);
  }, [searchCrops, query, selectedCategory]);

  const handleSelectCrop = (crop: CropProfile) => {
    changeCrop(crop);
    onClose();
  };

  const handleGenerateAI = async () => {
    if (!query.trim() || isGeneratingAI) return;
    setAiError(null);
    try {
      const newCrop = await generateAndAddCustomCrop(query.trim());
      onClose();
    } catch (err: any) {
      setAiError(err?.message || 'Không thể tạo hồ sơ cây trồng lúc này.');
    }
  };

  const difficultyMeta = {
    easy: { text: 'Dễ trồng', color: colors.success, bg: `${colors.success}18` },
    medium: { text: 'Trung bình', color: colors.warning, bg: `${colors.warning}18` },
    hard: { text: 'Khó / Công nghệ cao', color: colors.danger, bg: `${colors.danger}18` },
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Chọn Cây Trồng Vụ Mùa</Text>
            <Text style={styles.headerSubtitle}>
              Kho dữ liệu nông nghiệp chính xác & Sinh cây bằng AI
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <X size={20} color={colors.textMuted} strokeWidth={2.4} />
          </Pressable>
        </View>

        {/* Thanh tìm kiếm phong cách E-Commerce */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Search size={18} color={colors.textMuted} strokeWidth={2.2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm rau, củ, cây quả (vd: cải ngọt, dâu tây...)"
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={(text) => {
                setQuery(text);
                if (aiError) setAiError(null);
              }}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} style={styles.clearBtn}>
                <X size={15} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Danh mục (Category Chips) */}
        <View style={styles.categoriesWrap}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[{ id: 'all', name: 'Tất cả', icon: '🌾' }, ...CROP_CATEGORIES]}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.categoryList}
            renderItem={({ item }) => {
              const isSelected = selectedCategory === item.id;
              return (
                <Pressable
                  onPress={() => setSelectedCategory(item.id as any)}
                  style={[
                    styles.categoryChip,
                    isSelected && styles.categoryChipActive,
                  ]}
                >
                  <Text style={styles.chipIcon}>{item.icon}</Text>
                  <Text
                    style={[
                      styles.chipText,
                      isSelected && styles.chipTextActive,
                    ]}
                  >
                    {item.name}
                  </Text>
                </Pressable>
              );
            }}
          />
        </View>

        {/* Danh sách kết quả */}
        <FlatList
          data={filteredCrops}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            query.trim().length > 0 ? (
              <View style={styles.searchSummary}>
                <Text style={styles.searchSummaryText}>
                  Tìm thấy <Text style={styles.boldText}>{filteredCrops.length}</Text> giống cây
                  phù hợp với "{query}"
                </Text>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🔍</Text>
              <Text style={styles.emptyTitle}>Chưa có cây "{query}" trong kho mặc định</Text>
              <Text style={styles.emptySubtitle}>
                Bạn có thể yêu cầu AI Chuyên Gia Nông Nghiệp sinh hồ sơ nông học và ngưỡng môi
                trường chuẩn Việt Nam ngay lập tức!
              </Text>

              {aiError && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{aiError}</Text>
                </View>
              )}

              <Pressable
                onPress={handleGenerateAI}
                disabled={isGeneratingAI}
                style={({ pressed }) => [
                  styles.aiGenerateBtn,
                  isGeneratingAI && styles.btnDisabled,
                  pressed && styles.pressed,
                ]}
              >
                {isGeneratingAI ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Sparkles size={18} color="#FFFFFF" strokeWidth={2.2} />
                )}
                <Text style={styles.aiGenerateText}>
                  {isGeneratingAI
                    ? 'AI đang phân tích thổ nhưỡng & khí hậu VN...'
                    : `Sinh hồ sơ nông học cho "${query}" bằng AI`}
                </Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const isCurrent = selectedCrop.id === item.id;
            const diff = difficultyMeta[item.difficulty] ?? difficultyMeta.medium;

            return (
              <Pressable
                onPress={() => handleSelectCrop(item)}
                style={({ pressed }) => [
                  styles.cropCard,
                  isCurrent && styles.cropCardActive,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.cardMain}>
                  {/* Icon Avatar */}
                  <View style={[styles.avatarWrap, isCurrent && styles.avatarWrapActive]}>
                    <Text style={styles.avatarEmoji}>{item.icon}</Text>
                  </View>

                  {/* Thông tin chính */}
                  <View style={styles.infoCol}>
                    <View style={styles.titleRow}>
                      <Text style={styles.cropName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.isCustom && (
                        <View style={styles.customBadge}>
                          <Sparkles size={11} color={colors.primary[600]} />
                          <Text style={styles.customBadgeText}>AI Custom</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.scientificName} numberOfLines={1}>
                      {item.scientificName}
                    </Text>

                    <Text style={styles.description} numberOfLines={2}>
                      {item.description}
                    </Text>

                    {/* Metadata tags */}
                    <View style={styles.tagsRow}>
                      <View style={styles.tagItem}>
                        <Clock size={12} color={colors.textMuted} />
                        <Text style={styles.tagText}>{item.totalDays} ngày</Text>
                      </View>

                      <View style={styles.tagItem}>
                        <Layers size={12} color={colors.textMuted} />
                        <Text style={styles.tagText}>{item.stages.length} giai đoạn</Text>
                      </View>

                      <View style={[styles.diffBadge, { backgroundColor: diff.bg }]}>
                        <Text style={[styles.diffText, { color: diff.color }]}>
                          {diff.text}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.seasonRow}>
                      <Calendar size={12} color={colors.primary[500]} />
                      <Text style={styles.seasonText} numberOfLines={1}>
                        {item.vietnamSeason}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Right Action */}
                <View style={styles.actionCol}>
                  {isCurrent ? (
                    <View style={styles.activeCheck}>
                      <Check size={14} color="#FFFFFF" strokeWidth={2.8} />
                    </View>
                  ) : (
                    <ChevronRight size={18} color={colors.border} />
                  )}

                  {item.isCustom && !isCurrent && (
                    <Pressable
                      onPress={(e) => {
                        e.stopPropagation();
                        deleteCustomCrop(item.id);
                      }}
                      style={styles.deleteBtn}
                    >
                      <Trash2 size={15} color={colors.danger} />
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          }}
          ListFooterComponent={
            query.trim().length > 0 && filteredCrops.length > 0 ? (
              <View style={styles.aiFooterCard}>
                <View style={styles.aiFooterHeader}>
                  <Sparkles size={16} color={colors.primary[500]} />
                  <Text style={styles.aiFooterTitle}>Bạn tìm cây khác chưa có ở đây?</Text>
                </View>
                <Text style={styles.aiFooterSub}>
                  Hệ thống AI có thể tự động tra cứu dữ liệu nông nghiệp cho bất kỳ giống cây lạ nào.
                </Text>
                <Pressable
                  onPress={handleGenerateAI}
                  disabled={isGeneratingAI}
                  style={({ pressed }) => [
                    styles.aiFooterBtn,
                    isGeneratingAI && styles.btnDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  {isGeneratingAI ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Sparkles size={15} color="#FFFFFF" />
                      <Text style={styles.aiFooterBtnText}>
                        Khởi tạo cấu hình cho "{query}" bằng AI
                      </Text>
                    </>
                  )}
                </Pressable>
              </View>
            ) : null
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  searchSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: colors.text,
  },
  clearBtn: {
    padding: spacing.xs,
  },
  categoriesWrap: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.sm,
  },
  categoryList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[400],
  },
  chipIcon: {
    fontSize: 14,
  },
  chipText: {
    ...typography.caption,
    color: colors.textMuted,
    fontWeight: '500',
  },
  chipTextActive: {
    color: colors.primary[600],
    fontWeight: '700',
  },
  listContent: {
    padding: spacing.lg,
    paddingBottom: 40,
    gap: spacing.md,
  },
  searchSummary: {
    marginBottom: spacing.xs,
  },
  searchSummaryText: {
    ...typography.caption,
    color: colors.textMuted,
  },
  boldText: {
    color: colors.primary[600],
    fontWeight: '700',
  },
  cropCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1.5,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.soft,
  },
  cropCardActive: {
    borderColor: colors.primary[500],
    backgroundColor: '#FAFDFB',
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarWrapActive: {
    backgroundColor: colors.primary[100],
    borderColor: colors.primary[300],
  },
  avatarEmoji: {
    fontSize: 26,
  },
  infoCol: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cropName: {
    ...typography.h3,
    color: colors.text,
    flexShrink: 1,
  },
  customBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary[50],
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
    gap: 3,
  },
  customBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
    color: colors.primary[600],
  },
  scientificName: {
    ...typography.caption,
    fontStyle: 'italic',
    color: colors.textMuted,
    marginBottom: 4,
  },
  description: {
    ...typography.caption,
    color: colors.text,
    opacity: 0.85,
    lineHeight: 17,
    marginBottom: spacing.xs,
  },
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 2,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagText: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: colors.textMuted,
  },
  diffBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  diffText: {
    fontSize: 10,
    fontFamily: 'Inter-SemiBold',
  },
  seasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  seasonText: {
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    color: colors.primary[600],
  },
  actionCol: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    gap: spacing.md,
  },
  activeCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    padding: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.bodySm,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  errorBox: {
    backgroundColor: `${colors.danger}15`,
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: 12,
    color: colors.danger,
    fontFamily: 'Inter-Medium',
  },
  aiGenerateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[500],
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: spacing.sm,
    width: '100%',
    ...shadows.soft,
  },
  aiGenerateText: {
    ...typography.bodySm,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  aiFooterCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.base,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
  },
  aiFooterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  aiFooterTitle: {
    ...typography.bodySm,
    fontFamily: 'Inter-SemiBold',
    color: colors.text,
  },
  aiFooterSub: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 16,
    marginBottom: spacing.md,
  },
  aiFooterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[600],
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  aiFooterBtnText: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});
