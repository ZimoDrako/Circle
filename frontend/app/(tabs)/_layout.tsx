import { Tabs } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { useTheme } from "@/src/theme";

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brandPrimary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.divider },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Icon name="home" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="discover"
        options={{ title: "Discover", tabBarIcon: ({ color, size }) => <Icon name="compass" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="circles"
        options={{ title: "Circles", tabBarIcon: ({ color, size }) => <Icon name="people" size={size} color={color} /> }}
      />
      <Tabs.Screen
        name="create"
        options={{ title: "Create", tabBarIcon: ({ color, size }) => <Icon name="add-circle" size={size + 4} color={color} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: ({ color, size }) => <Icon name="person" size={size} color={color} /> }}
      />
    </Tabs>
  );
}
