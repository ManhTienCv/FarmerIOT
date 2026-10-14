import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CropProfile, CropStageConfig, CropCategory } from '@/types/crop';
import { INITIAL_CROPS } from '@/constants/cropDatabase';
import { getCurrentStage, getStageIndexForDay, getStartDayForStage, matchesSearchQuery } from '@/utils/agronomy';
import { generateCropProfileWithAI } from '@/services/aiCropProfiler';

const STORAGE_KEY_SELECTED_CROP_ID = '@aiot_selected_crop_id';
const STORAGE_KEY_STAGE_INDEX = '@aiot_stage_index';
const STORAGE_KEY_DAY_OF_CROP = '@aiot_day_of_crop';
const STORAGE_KEY_CUSTOM_CROPS = '@aiot_custom_crops';

interface CropContextType {
  selectedCrop: CropProfile;
  selectedStageIndex: number;
  currentStage: CropStageConfig;
  dayOfCrop: number;
  allCrops: CropProfile[];
  customCrops: CropProfile[];
  isGeneratingAI: boolean;
  changeCrop: (crop: CropProfile) => void;
  setStageIndex: (index: number) => void;
  setDayOfCrop: (day: number) => void;
  resetCropToDayOne: () => void;
  generateAndAddCustomCrop: (cropName: string) => Promise<CropProfile>;
  deleteCustomCrop: (cropId: string) => void;
  searchCrops: (query: string, category?: CropCategory | 'all') => CropProfile[];
}

const CropContext = createContext<CropContextType | null>(null);

export function CropProvider({ children }: { children: React.ReactNode }) {
  const [selectedCrop, setSelectedCrop] = useState<CropProfile>(INITIAL_CROPS[0]);
  const [selectedStageIndex, setSelectedStageIndex] = useState<number>(0);
  const [dayOfCrop, setDayOfCropState] = useState<number>(1);
  const [customCrops, setCustomCrops] = useState<CropProfile[]>([]);
  const [isGeneratingAI, setIsGeneratingAI] = useState<boolean>(false);

  // Load trạng thái đã lưu khi mở app
  useEffect(() => {
    (async () => {
      try {
        const [savedCropId, savedStage, savedDay, savedCustom] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_SELECTED_CROP_ID),
          AsyncStorage.getItem(STORAGE_KEY_STAGE_INDEX),
          AsyncStorage.getItem(STORAGE_KEY_DAY_OF_CROP),
          AsyncStorage.getItem(STORAGE_KEY_CUSTOM_CROPS),
        ]);

        let loadedCustom: CropProfile[] = [];
        if (savedCustom) {
          try {
            loadedCustom = JSON.parse(savedCustom);
            setCustomCrops(loadedCustom);
          } catch (e) {}
        }

        // Đề tài chuyên canh Dưa Lưới
        let targetCrop = INITIAL_CROPS[0];
        setSelectedCrop(targetCrop);

        let initialDay = 1;
        if (savedDay !== null) {
          const parsed = Number(savedDay);
          const maxDay = targetCrop.totalDays || 75;
          initialDay = isNaN(parsed) ? 1 : Math.min(Math.max(1, parsed), maxDay);
        }
        setDayOfCropState(initialDay);

        // Tự động đồng bộ giai đoạn chuẩn xác tuyệt đối theo ngày trồng
        const syncedStage = getStageIndexForDay(targetCrop, initialDay);
        setSelectedStageIndex(syncedStage);
      } catch (err) {
        console.warn('Lỗi khi nạp dữ liệu cây trồng từ Storage:', err);
      }
    })();
  }, []);

  const allCrops = useMemo(() => {
    return [...customCrops, ...INITIAL_CROPS];
  }, [customCrops]);

  const currentStage = useMemo(() => {
    return getCurrentStage(selectedCrop, selectedStageIndex);
  }, [selectedCrop, selectedStageIndex]);

  const changeCrop = (crop: CropProfile) => {
    setSelectedCrop(crop);
    setSelectedStageIndex(0);
    setDayOfCropState(1);
    AsyncStorage.setItem(STORAGE_KEY_SELECTED_CROP_ID, crop.id).catch(() => {});
    AsyncStorage.setItem(STORAGE_KEY_STAGE_INDEX, '0').catch(() => {});
    AsyncStorage.setItem(STORAGE_KEY_DAY_OF_CROP, '1').catch(() => {});
  };

  // Khi chọn một giai đoạn sinh trưởng: Tự động nhảy sang ngày đầu tiên của giai đoạn đó
  const setStageIndex = (index: number) => {
    const validIdx = Math.min(Math.max(0, index), selectedCrop.stages.length - 1);
    setSelectedStageIndex(validIdx);
    AsyncStorage.setItem(STORAGE_KEY_STAGE_INDEX, String(validIdx)).catch(() => {});

    const targetDay = getStartDayForStage(selectedCrop, validIdx);
    setDayOfCropState(targetDay);
    AsyncStorage.setItem(STORAGE_KEY_DAY_OF_CROP, String(targetDay)).catch(() => {});
  };

  // Khi thay đổi ngày trồng: Tự động tính toán và đồng bộ giai đoạn sinh trưởng
  const setDayOfCrop = (day: number) => {
    const validDay = Math.min(Math.max(1, day), selectedCrop.totalDays || 75);
    setDayOfCropState(validDay);
    AsyncStorage.setItem(STORAGE_KEY_DAY_OF_CROP, String(validDay)).catch(() => {});

    const targetStage = getStageIndexForDay(selectedCrop, validDay);
    if (targetStage !== selectedStageIndex) {
      setSelectedStageIndex(targetStage);
      AsyncStorage.setItem(STORAGE_KEY_STAGE_INDEX, String(targetStage)).catch(() => {});
    }
  };

  // Đặt lại ngày trồng về Ngày 1 (Bắt đầu vụ mới)
  const resetCropToDayOne = () => {
    setDayOfCropState(1);
    setSelectedStageIndex(0);
    AsyncStorage.setItem(STORAGE_KEY_DAY_OF_CROP, '1').catch(() => {});
    AsyncStorage.setItem(STORAGE_KEY_STAGE_INDEX, '0').catch(() => {});
  };

  const generateAndAddCustomCrop = async (cropName: string): Promise<CropProfile> => {
    setIsGeneratingAI(true);
    try {
      const newCrop = await generateCropProfileWithAI(cropName);
      const updated = [newCrop, ...customCrops];
      setCustomCrops(updated);
      setSelectedCrop(newCrop);
      setSelectedStageIndex(0);
      setDayOfCropState(1);

      AsyncStorage.setItem(STORAGE_KEY_CUSTOM_CROPS, JSON.stringify(updated)).catch(() => {});
      AsyncStorage.setItem(STORAGE_KEY_SELECTED_CROP_ID, newCrop.id).catch(() => {});
      AsyncStorage.setItem(STORAGE_KEY_STAGE_INDEX, '0').catch(() => {});
      AsyncStorage.setItem(STORAGE_KEY_DAY_OF_CROP, '1').catch(() => {});

      return newCrop;
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const deleteCustomCrop = (cropId: string) => {
    const updated = customCrops.filter((c) => c.id !== cropId);
    setCustomCrops(updated);
    AsyncStorage.setItem(STORAGE_KEY_CUSTOM_CROPS, JSON.stringify(updated)).catch(() => {});
    if (selectedCrop.id === cropId) {
      changeCrop(INITIAL_CROPS[0]);
    }
  };

  const searchCrops = (query: string, category?: CropCategory | 'all'): CropProfile[] => {
    return allCrops.filter((crop) => {
      const matchCat = !category || category === 'all' || crop.category === category;
      const matchQ = matchesSearchQuery(crop, query);
      return matchCat && matchQ;
    });
  };

  return (
    <CropContext.Provider
      value={{
        selectedCrop,
        selectedStageIndex,
        currentStage,
        dayOfCrop,
        allCrops,
        customCrops,
        isGeneratingAI,
        changeCrop,
        setStageIndex,
        setDayOfCrop,
        resetCropToDayOne,
        generateAndAddCustomCrop,
        deleteCustomCrop,
        searchCrops,
      }}
    >
      {children}
    </CropContext.Provider>
  );
}

export function useCrop() {
  const context = useContext(CropContext);
  if (!context) {
    throw new Error('useCrop must be used within a CropProvider');
  }
  return context;
}
