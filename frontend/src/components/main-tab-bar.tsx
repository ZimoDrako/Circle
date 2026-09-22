import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@/src/theme";

const tabs = [
  { label: "Home", icon: "home", path: "/(tabs)/home", match: "/home" },
  { label: "Discover", icon: "compass", path: "/(tabs)/discover", match: "/discover" },
  { label: "Circles", icon: "people", path: "/(tabs)/circles", match: "/circles" },
  { label: "Create", icon: "add-circle", path: "/(tabs)/create", match: "/create" },
  { label: "Profile", icon: "person", path: "/(tabs)/profile", match: "/profile" },
] as const;

export function MainTabBar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <View style={styles.bar}>
        {tabs.map((tab) => {
          const active = pathname === tab.match;
          const color = active ? colors.brandPrimary : colors.muted;
          return (
            <Pressable key={tab.label} onPress={() => router.replace(tab.path)} style={styles.item}>
              <Icon name={tab.icon} size={tab.label === "Create" ? 26 : 22} color={color} />
              <Text style={[styles.label, { color }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  bar: { minHeight: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 6 },
  label: { fontSize: 11, fontWeight: "600" },
});
