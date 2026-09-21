import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius } from "@/src/theme";
import { EmptyState } from "@/src/ui";
import { api } from "@/src/api";

export default function WeekendDigest() {
  const router = useRouter();
  const [digest, setDigest] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setDigest(await api.weekendDigest());
    } catch {}
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rsvp = async (id: string, status: "going" | "interested" | "none") => {
    try {
      await api.rsvp(id, status);
      load();
    } catch {}
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="digest-back"><Icon name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={styles.headerTitle}>This weekend on campus</Text>
        <View style={{ width: 26 }} />
      </View>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brandPrimary} />}
      >
        {digest && (
          <View style={styles.hero}>
            <Text style={styles.kicker}>{digest.is_friday ? "FRIDAY DIGEST" : "WEEKEND DIGEST"} · {digest.weekend_label}</Text>
            <Text style={styles.heroTitle}>{digest.headline}</Text>
            <Text style={styles.heroSub}>{digest.total_events} events Fri–Sun. Pick one, find people to go with, go together.</Text>
          </View>
        )}

        {digest && digest.total_events === 0 && (
          <EmptyState title="Quiet weekend so far" subtitle="Nothing posted for Fri–Sun yet. Be the one who starts the plan from the Create tab." />
        )}

        {(digest?.days || []).map((d: any) => (
          <View key={d.date} style={styles.day}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayLabel}>{d.label}</Text>
              <Text style={styles.dayDate}>{d.short}</Text>
            </View>
            {d.events.length === 0 && <Text style={styles.dayEmpty}>Nothing yet — open day!</Text>}
            {d.events.map((e: any) => (
              <Pressable key={e.id} testID={`digest-event-${e.id}`} onPress={() => router.push(`/event/${e.id}`)} style={styles.card}>
                <Image source={{ uri: e.cover_image_url }} style={styles.img} contentFit="cover" />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.cat}>{e.category.toUpperCase()} · {e.time}</Text>
                  <Text numberOfLines={2} style={styles.title}>{e.title}</Text>
                  <Text numberOfLines={1} style={styles.meta}>{e.location}</Text>
                  <View style={styles.row}>
                    <Text style={styles.count}>{e.interested_count || 0} interested</Text>
                    {e.vibe_count > 0 && (
                      <View style={styles.vibe}>
                        <Icon name="sparkles" size={10} color={colors.brandPrimary} />
                        <Text style={styles.vibeText}>{e.vibe_count} you vibe with</Text>
                      </View>
                    )}
                  </View>
                </View>
                <Pressable
                  testID={`digest-rsvp-${e.id}`}
                  onPress={() => rsvp(e.id, e.my_status ? "none" : "interested")}
                  style={[styles.star, e.my_status && styles.starOn]}
                  hitSlop={8}
                >
                  <Icon name={e.my_status ? "star" : "star-outline"} size={18} color={e.my_status ? colors.onBrandPrimary : colors.brandPrimary} />
                </Pressable>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  hero: { marginHorizontal: spacing.xl, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.brandTertiary },
  kicker: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  heroTitle: { color: colors.onBrandTertiary, fontSize: 22, fontWeight: "800", marginTop: 4 },
  heroSub: { color: colors.onBrandTertiary, fontSize: 13, marginTop: 6, opacity: 0.85, lineHeight: 18 },
  day: { paddingHorizontal: spacing.xl, marginTop: spacing.xl },
  dayHeader: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm, marginBottom: spacing.md },
  dayLabel: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  dayDate: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  dayEmpty: { color: colors.muted, fontSize: 13 },
  card: { flexDirection: "row", alignItems: "center", padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  img: { width: 72, height: 72, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  cat: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  title: { color: colors.onSurface, fontWeight: "700", fontSize: 14, marginTop: 2 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: 4 },
  count: { color: colors.muted, fontSize: 11 },
  vibe: { flexDirection: "row", alignItems: "center", gap: 3 },
  vibeText: { color: colors.brandPrimary, fontSize: 11, fontWeight: "600" },
  star: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginLeft: spacing.sm },
  starOn: { backgroundColor: colors.brandPrimary },
});
