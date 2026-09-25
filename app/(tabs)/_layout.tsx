import { Tabs } from 'expo-router';
import { LayoutGrid, ToggleLeft, BrainCircuit } from 'lucide-react-native';
import FloatingTabBar from '@/components/FloatingTabBar';
import { TabVisibilityProvider } from '@/context/TabVisibilityContext';

export default function TabLayout() {
  return (
    <TabVisibilityProvider>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...(props as any)} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Tổng quan',
            tabBarIcon: ({ color, size }) => (
              <LayoutGrid size={size} color={color} strokeWidth={2.2} />
            ),
          }}
        />
        <Tabs.Screen
          name="control"
          options={{
            title: 'Điều khiển',
            tabBarIcon: ({ color, size }) => (
              <ToggleLeft size={size} color={color} strokeWidth={2.2} />
            ),
          }}
        />
        <Tabs.Screen
          name="ai"
          options={{
            title: 'Chẩn đoán',
            tabBarIcon: ({ color, size }) => (
              <BrainCircuit size={size} color={color} strokeWidth={2.2} />
            ),
          }}
        />
      </Tabs>
    </TabVisibilityProvider>
  );
}
