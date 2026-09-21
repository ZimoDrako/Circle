import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius } from "@/src/theme";
import { Avatar, EmptyState, Chip } from "@/src/ui";
import { api } from "@/src/api";

export default function Circles() {
  const router = useRouter();
  const [mine, setMine] = useState(true);
  const [circles, setCircles] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await api.listCircles(mine);
      setCircles(r.circles || []);
    } catch {}
  }, [mine]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Circles</Text>
        <Text style={styles.sub}>Small groups. Real plans.</Text>
        <View style={styles.tabsRow}>
          <Chip label="Your Circles" selected={mine} onPress={() => setMine(true)} testID="circles-tab-mine" />
          <Chip label="Discover" selected={!mine} onPress={() => setMine(false)} testID="circles-tab-all" />
        </View>
      </View>

      <FlatList
        data={circles}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: 40 }}
        ListEmptyComponent={
          <EmptyState
            title={mine ? "No Circles yet" : "Nothing to discover"}
            subtitle={mine ? "Create a Circle from an event or the Create tab." : ""}
          />
        }
        renderItem={({ item: c }) => (
          <Pressable testID={`circle-card-${c.id}`} onPress={() => router.push(`/circle/${c.id}`)} style={styles.card}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={styles.avatarStack}>
                {c.members.slice(0, 4).map((m: any, i: number) => (
                  <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -14, borderWidth: 2, borderColor: colors.surface, borderRadius: 999 }}>
                    <Avatar uri={m.profile_photo_url} name={m.first_name} size={40} />
                  </View>
                ))}
              </View>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.name}>{c.name}</Text>
                <Text style={styles.meta}>{c.member_ids.length} members</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={colors.muted} />
            </View>
            <View style={styles.chips}>
              {c.interests.slice(0, 4).map((i: string) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText}>{i}</Text>
                </View>
              ))}
            </View>
            {c.shared_with_you?.length > 0 && (
              <View style={styles.whyRow}>
                <Icon name="sparkles" size={12} color={colors.brandPrimary} />
                <Text style={styles.whyText}>You share {c.shared_with_you.slice(0, 3).join(", ")}</Text>
              </View>
            )}
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface },
  sub: { color: colors.muted, fontSize: 14, marginTop: 2 },
  tabsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm },
  card: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  avatarStack: { flexDirection: "row" },
  name: { color: colors.onSurface, fontWeight: "700", fontSize: 16 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.md },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandTertiary },
  chipText: { color: colors.onBrandTertiary, fontWeight: "600", fontSize: 11 },
  whyRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm, gap: 6 },
  whyText: { color: colors.brandPrimary, fontSize: 12, fontWeight: "600" },
});
