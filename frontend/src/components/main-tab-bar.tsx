import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, useTheme } from "@/src/theme";

const sideTabs = [
  { label: "Home", icon: "home-outline", activeIcon: "home", path: "/(tabs)/home", match: "/home" },
  { label: "Discover", icon: "search-outline", activeIcon: "search", path: "/(tabs)/discover", match: "/discover" },
  { label: "Circles", icon: "people-outline", activeIcon: "people", path: "/(tabs)/circles", match: "/circles" },
  { label: "Profile", icon: "person-outline", activeIcon: "person", path: "/(tabs)/profile", match: "/profile" },
] as const;

export function MainTabBar() {
  const { colors: themeColors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const left = sideTabs.slice(0, 2);
  const right = sideTabs.slice(2);

  const renderTab = (tab: typeof sideTabs[number]) => {
    const active = pathname === tab.match;
    const color = active ? themeColors.brandPrimary : themeColors.muted;
    return (
      <Pressable key={tab.label} onPress={() => router.replace(tab.path)} style={styles.item}>
        <Icon name={active ? tab.activeIcon : tab.icon} size={22} color={color} />
        <Text style={[styles.label, { color }]}>{tab.label}</Text>
      </Pressable>
    );
  };

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <View style={styles.bar}>
        {left.map(renderTab)}
        <Pressable onPress={() => router.replace("/(tabs)/create")} style={styles.createWrap} testID="tab-create">
          <View style={[styles.createButton, pathname === "/create" && styles.createActive]}>
            <Icon name="add" size={32} color={themeColors.onBrandPrimary} />
          </View>
          <Text style={[styles.createLabel, pathname === "/create" && { color: themeColors.brandPrimary }]}>Create</Text>
        </Pressable>
        {right.map(renderTab)}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  bar: { minHeight: 64, flexDirection: "row", alignItems: "flex-end", paddingHorizontal: spacing.xs, paddingBottom: 3 },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 7 },
  label: { fontSize: 10, fontWeight: "600" },
  createWrap: { flex: 1.12, alignItems: "center", justifyContent: "flex-end" },
  createButton: {
    width: 54, height: 54, borderRadius: 27, marginTop: -20,
    backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center",
    borderWidth: 5, borderColor: colors.surface,
    shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 6,
  },
  createActive: { transform: [{ scale: 1.04 }] },
  createLabel: { fontSize: 10, fontWeight: "700", color: colors.onSurface, marginTop: 1 },
});
