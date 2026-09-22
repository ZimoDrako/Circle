import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius } from "@/src/theme";
import { Avatar, CompatibilityBadge, SectionTitle } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function Home() {
  const { user } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [circles, setCircles] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [digest, setDigest] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [m, e, c, r, rem, dg] = await Promise.all([
        api.getMatches(),
        api.listEvents(),
        api.listCircles(true),
        api.listRecommendations(),
        api.reminders(),
        api.weekendDigest(),
      ]);
      setMatches(m.matches || []);
      setEvents(e.events || []);
      setCircles(c.circles || []);
      setRecs(r.recommendations || []);
      setReminders(rem.reminders || []);
      setDigest(dg);
    } catch {}
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const dismissReminder = async (eventId: string) => {
    setReminders((r) => r.filter((x) => x.id !== eventId));
    try { await api.dismissReminder(eventId); } catch {}
  };

  const fmtMins = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`);
  const digestEvents = (digest?.days || []).flatMap((d: any) => d.events.map((e: any) => ({ ...e, dayLabel: d.label })));

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = events.slice(0, 4);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brandPrimary} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greet}>{greet},</Text>
            <Text style={styles.name}>{user?.first_name} 👋</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable onPress={() => router.push("/activity")} style={styles.bellButton} testID="home-activity">
              <Icon name="notifications-outline" size={23} color={colors.onSurface} />
              <View style={styles.notificationDot} />
            </Pressable>
            <Pressable onPress={() => router.push("/(tabs)/profile")}>
              <Avatar uri={user?.profile_photo_url ?? null} name={user?.first_name} size={44} />
            </Pressable>
          </View>
        </View>

        <View style={styles.heroSection}>
          <View style={styles.moveCard}>
            <View style={styles.moveIcon}><Icon name="sparkles" size={20} color={colors.onBrandPrimary} /></View>
            <Text style={styles.moveKicker}>YOUR DAY, YOUR PEOPLE</Text>
            <Text style={styles.moveTitle}>What's the move?</Text>
            <Text style={styles.moveCopy}>Tell Circle what you're up for today. We'll help find people who want the same thing.</Text>
            <Pressable onPress={() => router.push("/daily-circle")} style={styles.moveButton} testID="whats-the-move">
              <Text style={styles.moveButtonText}>Find my Circle</Text>
              <Icon name="arrow-forward" size={17} color={colors.onBrandPrimary} />
            </Pressable>
            <View style={styles.moveVibes}>
              {["Food", "Chill", "Study", "Active", "Explore"].map((v) => <View key={v} style={styles.vibePill}><Text style={styles.vibeText}>{v}</Text></View>)}
            </View>
          </View>
        </View>

        {reminders.map((r) => (
          <Pressable key={r.id} testID={`reminder-${r.id}`} onPress={() => router.push(`/event/${r.id}`)} style={styles.reminder}>
            <View style={styles.reminderIcon}><Icon name="alarm" size={20} color={colors.onBrandPrimary} /></View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.reminderTitle}>Starts in {fmtMins(r.starts_in_minutes)} · {r.title}</Text>
              <Text style={styles.reminderMeta} numberOfLines={1}>{`${r.time} at ${r.location} — you're ${r.my_status === "going" ? "going" : "interested"} 🙌`}</Text>
            </View>
            <Pressable onPress={() => dismissReminder(r.id)} hitSlop={8} testID={`reminder-dismiss-${r.id}`}>
              <Icon name="close" size={18} color={colors.onBrandPrimary} />
            </Pressable>
          </Pressable>
        ))}

        {digest && digest.total_events > 0 && (
          <View style={styles.section}>
            <Pressable testID="weekend-digest" onPress={() => router.push("/digest")} style={[styles.digest, digest.is_friday && styles.digestFriday]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.digestKicker}>{digest.is_friday ? "FRIDAY DIGEST" : "WEEKEND DIGEST"} · {digest.weekend_label}</Text>
                  <Text style={styles.digestTitle}>{digest.headline}</Text>
                  <Text style={styles.digestMeta}>{digest.total_events} events Fri–Sun · tap to plan ahead</Text>
                </View>
                <Icon name="arrow-forward-circle" size={32} color={colors.brandPrimary} />
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginTop: spacing.md }}>
                {digestEvents.slice(0, 6).map((e: any) => (
                  <Pressable key={e.id} onPress={() => router.push(`/event/${e.id}`)} style={styles.digestChip}>
                    <Text style={styles.digestChipDay}>{e.dayLabel.slice(0, 3).toUpperCase()} · {e.time}</Text>
                    <Text numberOfLines={1} style={styles.digestChipTitle}>{e.title}</Text>
                    {e.vibe_count > 0 && <Text style={styles.digestChipVibe}>{e.vibe_count} you vibe with going</Text>}
                  </Pressable>
                ))}
              </ScrollView>
            </Pressable>
          </View>
        )}

        <View style={styles.section}>
          <SectionTitle title="Happening today" action="See all" onAction={() => router.push("/(tabs)/discover")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.xl }}>
            {today.map((e) => (
              <Pressable key={e.id} testID={`home-event-${e.id}`} onPress={() => router.push(`/event/${e.id}`)} style={styles.eventCard}>
                <Image source={{ uri: e.cover_image_url }} style={styles.eventImg} contentFit="cover" />
                <LinearGradient colors={["transparent", "rgba(9,9,11,0.85)"]} style={styles.eventScrim} />
                <View style={styles.eventBody}>
                  <Text style={styles.eventCat}>{e.category.toUpperCase()}</Text>
                  <Text numberOfLines={2} style={styles.eventTitle}>{e.title}</Text>
                  <Text style={styles.eventMeta}>{e.time} · {e.interested_count || 0} interested</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <SectionTitle title="People you might vibe with" action="See all" onAction={() => router.push("/(tabs)/discover")} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md, paddingRight: spacing.xl }}>
            {matches.slice(0, 8).map((m) => (
              <Pressable key={m.user.id} testID={`home-match-${m.user.id}`} onPress={() => router.push(`/match/${m.user.id}`)} style={styles.matchCard}>
                <Avatar uri={m.user.profile_photo_url} name={m.user.first_name} size={64} />
                <View style={{ marginTop: spacing.sm, alignItems: "center" }}>
                  <Text style={styles.matchName}>{m.user.first_name}</Text>
                  <Text style={styles.matchMeta}>{m.user.major || m.user.year}</Text>
                  <View style={{ height: spacing.xs }} />
                  <CompatibilityBadge score={m.compatibility} />
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        {circles.length > 0 && (
          <View style={styles.section}>
            <SectionTitle title="Your Circles" action="See all" onAction={() => router.push("/(tabs)/circles")} />
            {circles.slice(0, 3).map((c) => (
              <Pressable key={c.id} onPress={() => router.push(`/circle/${c.id}`)} style={styles.circleRow}>
                <View style={styles.avatarStack}>
                  {c.members.slice(0, 3).map((m: any, i: number) => (
                    <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -12 }}>
                      <Avatar uri={m.profile_photo_url} name={m.first_name} size={36} />
                    </View>
                  ))}
                </View>
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.circleName}>{c.name}</Text>
                  <Text style={styles.circleMeta}>{c.member_ids.length} members · {c.interests.slice(0, 3).join(" · ")}</Text>
                </View>
                <Icon name="chevron-forward" size={20} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        )}

        {recs.length > 0 && (
          <View style={styles.section}>
            <SectionTitle title="Try something new" />
            {recs.slice(0, 3).map((r) => (
              <Pressable key={r.id} onPress={() => router.push(`/recommendation/${r.id}`)} style={styles.recRow}>
                <Image source={{ uri: r.image_url }} style={styles.recImg} contentFit="cover" />
                <View style={{ flex: 1, marginLeft: spacing.md }}>
                  <Text style={styles.recCat}>{r.category.toUpperCase()}</Text>
                  <Text numberOfLines={2} style={styles.recTitle}>{r.title}</Text>
                  <Text numberOfLines={1} style={styles.recCreator}>by {r.creator_name}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.xl, paddingBottom: 0 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  bellButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center" },
  notificationDot: { position: "absolute", top: 8, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error, borderWidth: 2, borderColor: colors.surface },
  heroSection: { paddingHorizontal: spacing.xl, marginTop: spacing.xl },
  moveCard: { borderRadius: 26, backgroundColor: colors.onSurface, padding: spacing.xl, overflow: "hidden" },
  moveIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", marginBottom: spacing.md },
  moveKicker: { color: colors.brandSecondary, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  moveTitle: { color: "#FFFFFF", fontSize: 27, fontWeight: "800", marginTop: 4 },
  moveCopy: { color: "rgba(255,255,255,0.72)", fontSize: 14, lineHeight: 20, marginTop: spacing.sm, maxWidth: 420 },
  moveButton: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 12, marginTop: spacing.lg },
  moveButtonText: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 14 },
  moveVibes: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.lg },
  vibePill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.09)" },
  vibeText: { color: "rgba(255,255,255,0.78)", fontSize: 11, fontWeight: "600" },
  greet: { color: colors.muted, fontSize: 14 },
  name: { color: colors.onSurface, fontSize: 24, fontWeight: "800", marginTop: 2 },
  section: { paddingHorizontal: spacing.xl, marginTop: spacing.md },
  eventCard: { width: 240, height: 160, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary },
  eventImg: { ...StyleSheet.absoluteFill },
  eventScrim: { ...StyleSheet.absoluteFill },
  eventBody: { position: "absolute", left: spacing.md, right: spacing.md, bottom: spacing.md },
  eventCat: { color: colors.brandSecondary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  eventTitle: { color: "#FFFFFF", fontSize: 15, fontWeight: "700", marginTop: 2 },
  eventMeta: { color: "rgba(255,255,255,0.85)", fontSize: 12, marginTop: 4 },
  matchCard: { width: 140, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, alignItems: "center" },
  matchName: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },
  matchMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },
  circleRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, marginBottom: spacing.sm },
  avatarStack: { flexDirection: "row" },
  circleName: { color: colors.onSurface, fontWeight: "700", fontSize: 15 },
  circleMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  recRow: { flexDirection: "row", alignItems: "center", padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, marginBottom: spacing.sm },
  recImg: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  recCat: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  recTitle: { color: colors.onSurface, fontWeight: "700", fontSize: 14, marginTop: 2 },
  recCreator: { color: colors.muted, fontSize: 12, marginTop: 2 },
  reminder: { flexDirection: "row", alignItems: "center", marginHorizontal: spacing.xl, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.brandPrimary },
  reminderIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  reminderTitle: { color: colors.onBrandPrimary, fontWeight: "800", fontSize: 14 },
  reminderMeta: { color: colors.onBrandPrimary, fontSize: 12, marginTop: 2, opacity: 0.9 },
  digest: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.brandTertiary, borderWidth: 1, borderColor: colors.border, marginTop: spacing.lg },
  digestFriday: { borderColor: colors.brandPrimary, borderWidth: 2 },
  digestKicker: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  digestTitle: { color: colors.onBrandTertiary, fontSize: 18, fontWeight: "800", marginTop: 4 },
  digestMeta: { color: colors.onBrandTertiary, fontSize: 12, marginTop: 2, opacity: 0.8 },
  digestChip: { width: 150, padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surface },
  digestChipDay: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  digestChipTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "700", marginTop: 2 },
  digestChipVibe: { color: colors.muted, fontSize: 10, marginTop: 2 },
});
