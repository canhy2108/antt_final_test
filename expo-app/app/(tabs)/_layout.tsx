import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ColorValue, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Colors, Shadow } from '@/theme';
import { haptic } from '@/utils/haptics';

export default function TabsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: styles.tabBar,
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.grey400,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} color={color} /> }}
        />
        <Tabs.Screen
          name="accounts"
          options={{ tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'wallet' : 'wallet-outline'} color={color} /> }}
        />
        <Tabs.Screen
          name="add"
          options={{
            tabBarIcon: () => <View style={styles.fabPlaceholder} />,
            tabBarButton: () => (
              <Pressable
                style={styles.fabWrap}
                onPress={() => {
                  haptic.medium();
                  router.push('/transaction/new');
                }}
              >
                <View style={styles.fab}>
                  <Ionicons name="add" size={32} color={Colors.dark} />
                </View>
              </Pressable>
            ),
          }}
        />
        <Tabs.Screen
          name="reports"
          options={{ tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'bar-chart' : 'bar-chart-outline'} color={color} /> }}
        />
        <Tabs.Screen
          name="settings"
          options={{ tabBarIcon: ({ color, focused }) => <TabIcon name={focused ? 'settings' : 'settings-outline'} color={color} /> }}
        />
        <Tabs.Screen name="budget" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

function TabIcon({ name, color }: { name: keyof typeof Ionicons.glyphMap; color: ColorValue }) {
  return <Ionicons name={name} size={26} color={color as string} />;
}

const styles = StyleSheet.create({
  tabBar: {
    height: 76,
    borderTopWidth: 0,
    backgroundColor: Colors.surface,
    paddingTop: 8,
    paddingBottom: 16,
    ...Shadow.l,
  },
  fabWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fabPlaceholder: { width: 56, height: 56 },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadow.green,
  },
});
