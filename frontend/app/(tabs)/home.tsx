import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, Modal } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius, useTheme, makeStyles } from "@/src/theme";
import { Avatar, CompatibilityBadge, SectionTitle } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function Home() {
  const { colors: themeColors } = useTheme();
  const styles = useStyles();
  const { user } = useAuth();
  const router = useRouter();
  const [matches, setMatches] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [circles, setCircles] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [digest, setDigest] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [posts, setPosts] = useState<any[]>([]);
  const [feedMode, setFeedMode] = useState<"for_you" | "connections">("for_you");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [m, e, c, r, rem, dg, nt, pf] = await Promise.all([
        api.getMatches(),
        api.listEvents(),
        api.listCircles(true),
        api.listRecommendations(),
        api.reminders(),
        api.weekendDigest(),
        api.notifications(),
        api.listPosts(undefined, feedMode),
      ]);
      setMatches(m.matches || []);
      setEvents(e.events || []);
      setCircles(c.circles || []);
      setRecs(r.recommendations || []);
      setReminders(rem.reminders || []);
      setDigest(dg);
      setUnreadCount(nt.unread_count || 0);
      setPosts(pf.posts || []);
    } catch {}
    setRefreshing(false);
  }, [feedMode]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const dismissReminder = async (eventId: string) => {
    setReminders((r) => r.filter((x) => x.id !== eventId));
    try { await api.dismissReminder(eventId); } catch {}
  };

  const fmtMins = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`);
  const digestEvents = (digest?.days || []).flatMap((d: any) => d.events.map((e: any) => ({ ...e, dayLabel: d.label })));

  const today = events.slice(0, 4);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={colors.brandPrimary} />}
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.push("/(tabs)/profile")} style={styles.profileShortcut} testID="home-profile">
            <Avatar uri={user?.profile_photo_url ?? null} name={user?.first_name} size={52} />
          </Pressable>
          <Text style={styles.wordmark}>Circle</Text>
          <Pressable onPress={() => router.push("/activity")} style={styles.bellButton} testID="home-activity">
            <Icon name="notifications-outline" size={23} color={themeColors.onSurface} />
            {unreadCount > 0 && (
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.feedHeader}>
          <View><Text style={styles.feedKicker}>CAMPUS FEED</Text><Text style={styles.feedTitle}>What's happening</Text></View>
          <Pressable onPress={() => setCreateMenuOpen(true)} style={styles.feedCreate} testID="home-create-menu"><Icon name="add" size={27} color={themeColors.onSurface} /></Pressable>
        </View>
        <View style={styles.feedTabs}>
          <Pressable onPress={() => setFeedMode("for_you")} style={[styles.feedTab, feedMode === "for_you" && styles.feedTabActive]}><Text style={[styles.feedTabText, feedMode === "for_you" && styles.feedTabTextActive]}>For You</Text></Pressable>
          <Pressable onPress={() => setFeedMode("connections")} style={[styles.feedTab, feedMode === "connections" && styles.feedTabActive]}><Text style={[styles.feedTabText, feedMode === "connections" && styles.feedTabTextActive]}>Connections</Text></Pressable>
        </View>
        <View style={styles.feed}>
          {posts.length === 0 ? <View style={styles.feedEmpty}><Icon name="chatbubbles-outline" size={28} color={themeColors.brandPrimary} /><Text style={styles.feedEmptyTitle}>{feedMode === "connections" ? "Your connections are quiet" : "Campus is quiet right now"}</Text><Text style={styles.feedEmptyText}>Start something. Ask a question, make a plan, or find people who are down.</Text></View> : posts.map((post:any) => {
            const actionable = ["anyone_down","looking_for_people"].includes(post.intent);
            return <Pressable key={post.id} onPress={() => router.push(`/post/${post.id}`)} style={styles.feedPost}>
              <Avatar uri={post.author?.profile_photo_url} name={post.author?.first_name} size={42} />
              <View style={styles.feedPostBody}><View style={styles.feedPostTop}><Text style={styles.feedPostName}>{post.author?.first_name} {post.author?.last_name}</Text><Text style={styles.feedPostIntent}>{post.intent === "anyone_down" ? "Anyone down?" : post.intent === "looking_for_people" ? "Looking for people" : post.intent === "question" ? "Question" : post.intent === "recommendation" ? "Recommendation" : post.intent === "event" ? "Event" : "Post"}</Text></View><Text style={styles.feedPostText}>{post.content}</Text><View style={styles.feedPostActions}><Icon name="chatbubble-outline" size={15} color={themeColors.muted} />{actionable && <><Icon name="people-outline" size={16} color={themeColors.brandPrimary} /><Text style={styles.feedDown}>{post.interest_count || 0} down</Text></>}</View></View>
            </Pressable>;
          })}
        </View>

        {reminders.map((r) => (
          <Pressable key={r.id} testID={`reminder-${r.id}`} onPress={() => router.push(`/event/${r.id}`)} style={styles.reminder}>
            <View style={styles.reminderIcon}><Icon name="alarm" size={20} color={themeColors.onBrandPrimary} /></View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.reminderTitle}>Starts in {fmtMins(r.starts_in_minutes)} · {r.title}</Text>
              <Text style={styles.reminderMeta} numberOfLines={1}>{`${r.time} at ${r.location} — you're ${r.my_status === "going" ? "going" : "interested"} 🙌`}</Text>
            </View>
            <Pressable onPress={() => dismissReminder(r.id)} hitSlop={8} testID={`reminder-dismiss-${r.id}`}>
              <Icon name="close" size={18} color={themeColors.onBrandPrimary} />
            </Pressable>
          </Pressable>
        ))}

        {digest && digest.total_events > 0 && (
          <View style={styles.weekendSection}>
            <View style={styles.weekendHeader}>
              <View>
                <Text style={styles.weekendKicker}>THIS WEEKEND</Text>
                <Text style={styles.weekendTitle}>{digest.weekend_label}</Text>
              </View>
              <Pressable onPress={() => router.push("/digest")} testID="weekend-digest">
                <Text style={styles.weekendSee}>See weekend →</Text>
              </Pressable>
            </View>
            <View style={styles.weekendList}>
              {digestEvents.slice(0, 3).map((e: any) => (
                <Pressable key={e.id} onPress={() => router.push(`/event/${e.id}`)} style={styles.weekendEvent}>
                  <View style={styles.weekendDay}><Text style={styles.weekendDayText}>{e.dayLabel.slice(0, 3).toUpperCase()}</Text></View>
                  <View style={styles.weekendEventBody}>
                    <Text numberOfLines={1} style={styles.weekendEventTitle}>{e.title}</Text>
                    <Text style={styles.weekendEventMeta}>{e.time}{e.vibe_count > 0 ? ` · ${e.vibe_count} you vibe with going` : ""}</Text>
                  </View>
                  <Icon name="chevron-forward" size={18} color={themeColors.muted} />
                </Pressable>
              ))}
            </View>
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
                <Icon name="chevron-forward" size={20} color={themeColors.muted} />
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

      <Modal visible={createMenuOpen} transparent animationType="fade" onRequestClose={() => setCreateMenuOpen(false)}>
        <Pressable style={styles.createOverlay} onPress={() => setCreateMenuOpen(false)}>
          <View style={styles.createSheet}>
            <View style={styles.createHandle} />
            <Text style={styles.createTitle}>Start something</Text>
            <Text style={styles.createSub}>What do you want to do?</Text>
            <Pressable style={styles.createOption} onPress={() => { setCreateMenuOpen(false); router.push("/create-post"); }} testID="home-create-post">
              <View style={styles.createOptionIcon}><Icon name="create-outline" size={22} color={themeColors.brandPrimary} /></View>
              <View style={{ flex: 1 }}><Text style={styles.createOptionTitle}>Create a post</Text><Text style={styles.createOptionText}>Share something with campus or your connections.</Text></View>
              <Icon name="chevron-forward" size={20} color={themeColors.muted} />
            </Pressable>
            <Pressable style={styles.createOption} onPress={() => { setCreateMenuOpen(false); router.push("/daily-circle"); }} testID="home-find-circle">
              <View style={styles.createOptionIcon}><Icon name="people-outline" size={22} color={themeColors.brandPrimary} /></View>
              <View style={{ flex: 1 }}><Text style={styles.createOptionTitle}>Find my Circle</Text><Text style={styles.createOptionText}>Find people who are up for the same thing today.</Text></View>
              <Icon name="chevron-forward" size={20} color={themeColors.muted} />
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { height: 68, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl },
  profileShortcut: { width: 52, height: 52, borderRadius: 26 },
  wordmark: { position: "absolute", left: 80, right: 80, textAlign: "center", color: colors.onSurface, fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
  bellButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  notificationBadge: { position: "absolute", top: -3, right: -3, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.error, borderWidth: 2, borderColor: colors.surface, alignItems: "center", justifyContent: "center" },
  notificationBadgeText: { color: "#FFFFFF", fontSize: 9, fontWeight: "800", lineHeight: 11 },
  feedHeader: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  feedKicker: { fontSize: 10, fontWeight: "900", letterSpacing: 1.1, color: colors.brandPrimary }, feedTitle: { fontSize: 23, fontWeight: "900", color: colors.onSurface, marginTop: 2 },
  feedCreate: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  feedTabs: { marginHorizontal: spacing.xl, marginTop: spacing.md, flexDirection: "row", borderBottomWidth: 1, borderBottomColor: colors.divider }, feedTab: { paddingVertical: 10, marginRight: 24 }, feedTabActive: { borderBottomWidth: 2, borderBottomColor: colors.brandPrimary }, feedTabText: { color: colors.muted, fontSize: 13, fontWeight: "700" }, feedTabTextActive: { color: colors.onSurface, fontWeight: "900" },
  feed: { paddingHorizontal: spacing.xl, minHeight: 360 }, feedPost: { flexDirection: "row", gap: 10, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.divider }, feedPostBody: { flex: 1 }, feedPostTop: { flexDirection: "row", alignItems: "center", gap: 7 }, feedPostName: { flexShrink: 1, color: colors.onSurface, fontSize: 14, fontWeight: "900" }, feedPostIntent: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800" }, feedPostText: { color: colors.onSurface, fontSize: 15, lineHeight: 21, marginTop: 6 }, feedPostActions: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 9 }, feedDown: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800" }, feedEmpty: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 28 }, feedEmptyTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "900", marginTop: 8 }, feedEmptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center", marginTop: 4 },
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
  weekendSection: { marginHorizontal: spacing.xl, marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.divider },
  weekendHeader: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: spacing.sm },
  weekendKicker: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  weekendTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "900", marginTop: 2 },
  weekendSee: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800", paddingVertical: 4 },
  weekendList: { borderTopWidth: 1, borderTopColor: colors.divider },
  weekendEvent: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  weekendDay: { width: 42, height: 30, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  weekendDayText: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900", letterSpacing: 0.5 },
  weekendEventBody: { flex: 1, minWidth: 0 },
  weekendEventTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  weekendEventMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  createOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.48)", justifyContent: "flex-end" },
  createSheet: { backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.xl, paddingTop: 10, paddingBottom: 36 },
  createHandle: { width: 42, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: "center", marginBottom: spacing.lg },
  createTitle: { color: colors.onSurface, fontSize: 22, fontWeight: "900" },
  createSub: { color: colors.muted, fontSize: 13, marginTop: 3, marginBottom: spacing.lg },
  createOption: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.divider },
  createOptionIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  createOptionTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "900" },
  createOptionText: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
}));
