import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { colors, radius, spacing } from '@/constants/theme';
import { useTabVisibility } from '@/context/TabVisibilityContext';

export interface FloatingTabBarProps {
  state: {
    index: number;
    routes: Array<{ key: string; name: string }>;
  };
  descriptors: Record<
    string,
    {
      options: {
        tabBarLabel?: string | ((props: { focused: boolean; color: string; position: any; children: string }) => React.ReactNode);
        title?: string;
        tabBarAccessibilityLabel?: string;
        tabBarIcon?: (props: { focused: boolean; color: string; size: number }) => React.ReactNode;
      };
    }
  >;
  navigation: {
    emit: (event: { type: string; target: string; canPreventDefault: boolean }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

export default function FloatingTabBar({ state, descriptors, navigation }: FloatingTabBarProps) {
  const { tabBarTranslateY } = useTabVisibility();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: tabBarTranslateY.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]} pointerEvents="box-none">
      <View style={styles.pill}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              style={[styles.tabItem, isFocused && styles.tabItemActive]}
            >
              {options.tabBarIcon?.({
                focused: isFocused,
                color: isFocused ? colors.primary[500] : colors.textMuted,
                size: 20,
              })}
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? colors.primary[500] : colors.textMuted },
                  isFocused && styles.tabLabelActive,
                ]}
                numberOfLines={1}
              >
                {label as string}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 24 : 16,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    zIndex: 999,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(227, 236, 229, 0.95)',
    maxWidth: 420,
    width: '92%',
    shadowColor: '#1A2E22',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    gap: 5,
  },
  tabItemActive: {
    backgroundColor: 'rgba(45, 106, 79, 0.12)',
  },
  tabLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    fontFamily: 'Inter-Medium',
  },
  tabLabelActive: {
    fontWeight: '700',
    fontFamily: 'Inter-Bold',
  },
});
