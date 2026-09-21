import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, FlatList } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius } from "@/src/theme";
import { Avatar, CompatibilityBadge, Chip, EmptyState } from "@/src/ui";
import { api } from "@/src/api";

const TABS = ["Events", "People", "Recommendations", "Clubs"] as const;

export default function Discover() {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Events");
  const [q, setQ] = useState("");
  const [events, setEvents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [e, u, r, c] = await Promise.all([
        api.listEvents({ q }),
        api.listUsers(q || undefined),
        api.listRecommendations(q || undefined),
        api.listClubs(),
      ]);
      setEvents(e.events || []);
      setUsers(u.users || []);
      setRecs(r.recommendations || []);
      setClubs(c.clubs || []);
    } catch {}
  }, [q]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Discover</Text>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            testID="discover-search"
            value={q}
            onChangeText={setQ}
            onSubmitEditing={load}
            placeholder="Search people, events, clubs..."
            placeholderTextColor={colors.muted}
            style={{ flex: 1, marginLeft: spacing.sm, color: colors.onSurface }}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }}>
          {TABS.map((t) => (
            <Chip key={t} label={t} selected={tab === t} onPress={() => setTab(t)} testID={`discover-tab-${t}`} />
          ))}
        </ScrollView>
      </View>

      {tab === "Events" && (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: 40 }}
          ListEmptyComponent={<EmptyState title="No events yet" subtitle="Check back soon." />}
          renderItem={({ item: e }) => (
            <Pressable testID={`event-card-${e.id}`} onPress={() => router.push(`/event/${e.id}`)} style={styles.eventCard}>
              <Image source={{ uri: e.cover_image_url }} style={styles.eventImg} contentFit="cover" />
              <LinearGradient colors={["transparent", "rgba(9,9,11,0.85)"]} style={StyleSheet.absoluteFill} />
              <View style={styles.eventBody}>
                <Text style={styles.eventCat}>{e.category.toUpperCase()}</Text>
                <Text style={styles.eventTitle}>{e.title}</Text>
                <View style={styles.eventMetaRow}>
                  <Icon name="calendar-outline" size={13} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.eventMeta}>{e.date} · {e.time}</Text>
                  <Icon name="people-outline" size={13} color="rgba(255,255,255,0.9)" style={{ marginLeft: spacing.sm }} />
                  <Text style={styles.eventMeta}>{e.interested_count || 0} interested</Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      {tab === "People" && (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={{ padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: 40 }}
          ListEmptyComponent={<EmptyState title="No people" />}
          renderItem={({ item: u }) => (
            <Pressable testID={`person-card-${u.id}`} onPress={() => router.push(`/match/${u.id}`)} style={styles.personCard}>
              <Avatar uri={u.profile_photo_url} name={u.first_name} size={72} />
              <Text style={styles.personName}>{u.first_name}</Text>
              <Text style={styles.personMeta}>{u.major}</Text>
              <View style={{ height: 6 }} />
              <Text style={styles.personInt} numberOfLines={1}>{(u.interests || []).slice(0, 3).join(" · ")}</Text>
            </Pressable>
          )}
        />
      )}

      {tab === "Recommendations" && (
        <FlatList
          data={recs}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: 40 }}
          ListEmptyComponent={<EmptyState title="No recommendations yet" />}
          renderItem={({ item: r }) => (
            <View style={styles.recCard}>
              <Image source={{ uri: r.image_url }} style={styles.recImg} contentFit="cover" />
              <View style={{ padding: spacing.md }}>
                <Text style={styles.recCat}>{r.category.toUpperCase()}</Text>
                <Text style={styles.recTitle}>{r.title}</Text>
                <Text style={styles.recDesc} numberOfLines={2}>{r.description}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: spacing.sm }}>
                  <Avatar uri={r.creator_photo} name={r.creator_name} size={24} />
                  <Text style={styles.recBy}>{r.creator_name}</Text>
                  <View style={{ flex: 1 }} />
                  <Icon name="bookmark-outline" size={16} color={colors.muted} />
                  <Text style={{ color: colors.muted, marginLeft: 4, fontSize: 12 }}>{r.saves}</Text>
                </View>
              </View>
            </View>
          )}
        />
      )}

      {tab === "Clubs" && (
        <FlatList
          data={clubs}
          keyExtractor={(c) => c.id}
          numColumns={2}
          columnWrapperStyle={{ gap: spacing.md }}
          contentContainerStyle={{ padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: 40 }}
          ListEmptyComponent={<EmptyState title="No clubs" />}
          renderItem={({ item: c }) => (
            <View style={styles.clubCard}>
              <Image source={{ uri: c.image_url }} style={styles.clubImg} contentFit="cover" />
              <View style={{ padding: spacing.md }}>
                <Text style={styles.clubName} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.clubMeta} numberOfLines={2}>{c.description}</Text>
                <Text style={styles.clubCount}>{c.member_ids?.length || 0} members</Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.md },
  searchBox: {
    flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 10, borderWidth: 1, borderColor: colors.border,
  },
  eventCard: { height: 170, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary },
  eventImg: { ...StyleSheet.absoluteFill },
  eventBody: { position: "absolute", left: spacing.lg, right: spacing.lg, bottom: spacing.lg },
  eventCat: { color: colors.brandSecondary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  eventTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "800", marginTop: 2 },
  eventMetaRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.xs, gap: 4 },
  eventMeta: { color: "rgba(255,255,255,0.9)", fontSize: 12 },
  personCard: { flex: 1, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, alignItems: "center" },
  personName: { color: colors.onSurface, fontWeight: "700", fontSize: 15, marginTop: spacing.sm },
  personMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  personInt: { color: colors.brandPrimary, fontSize: 11, fontWeight: "600" },
  recCard: { borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary },
  recImg: { width: "100%", height: 140 },
  recCat: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  recTitle: { color: colors.onSurface, fontWeight: "700", fontSize: 16, marginTop: 4 },
  recDesc: { color: colors.muted, fontSize: 13, marginTop: 4, lineHeight: 18 },
  recBy: { color: colors.onSurface, fontWeight: "600", fontSize: 12, marginLeft: 6 },
  clubCard: { flex: 1, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary },
  clubImg: { width: "100%", height: 90 },
  clubName: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },
  clubMeta: { color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  clubCount: { color: colors.brandPrimary, fontSize: 11, fontWeight: "600", marginTop: 6 },
});
