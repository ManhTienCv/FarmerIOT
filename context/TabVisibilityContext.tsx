import React, { createContext, useContext, useRef, useCallback } from 'react';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

interface TabVisibilityContextType {
  tabBarTranslateY: SharedValue<number>;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const TabVisibilityContext = createContext<TabVisibilityContextType | null>(null);

export function TabVisibilityProvider({ children }: { children: React.ReactNode }) {
  const tabBarTranslateY = useSharedValue(0);
  const lastScrollY = useRef(0);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = e.nativeEvent.contentOffset.y;
      const diff = currentY - lastScrollY.current;

      // Nếu đang ở gần đầu trang -> luôn luôn hiện thanh navbar
      if (currentY <= 15) {
        tabBarTranslateY.value = withTiming(0, { duration: 250 });
      }
      // Cuộn xuống (Scroll Down) -> thụt xuống biến mất
      else if (diff > 6 && currentY > 40) {
        tabBarTranslateY.value = withTiming(110, { duration: 250 });
      }
      // Cuộn lên (Scroll Up) -> nhô lên xuất hiện
      else if (diff < -6) {
        tabBarTranslateY.value = withTiming(0, { duration: 250 });
      }

      lastScrollY.current = currentY;
    },
    [tabBarTranslateY],
  );

  return (
    <TabVisibilityContext.Provider value={{ tabBarTranslateY, onScroll }}>
      {children}
    </TabVisibilityContext.Provider>
  );
}

export function useTabVisibility() {
  const ctx = useContext(TabVisibilityContext);
  if (!ctx) {
    throw new Error('useTabVisibility must be used within TabVisibilityProvider');
  }
  return ctx;
}
