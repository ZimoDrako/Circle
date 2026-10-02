import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, Modal, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { spacing, radius, useTheme, makeStyles } from "@/src/theme";
import { Avatar } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { rankHomeEvents, mixHomeFeed, eventDayLabel } from "@/src/discovery";
import type { HomeEventCard } from "@/src/discovery";

export default function Home() {
  const { colors: themeColors } = useTheme();
  const styles = useStyles();
  const { user } = useAuth();
  const router = useRouter();
  const [reminders, setReminders] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [posts, setPosts] = useState<any[]>([]);
  const [feedMode, setFeedMode] = useState<"for_you" | "connections">("for_you");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  const [loadedMode, setLoadedMode] = useState<typeof feedMode | null>(null);
  const [loadError, setLoadError] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);
  const [clock, setClock] = useState(() => new Date());
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    setRefreshing(true);
    setLoadError("");
    const results = await Promise.allSettled([
      api.reminders(), api.notifications(), api.listPosts(undefined, feedMode),
      feedMode === "for_you" ? api.getMatches() : Promise.resolve({ matches: [] }),
      feedMode === "for_you" ? api.listEvents() : Promise.resolve({ events: [] }),
    ]);
    if (request !== requestId.current) return;
    const [rem, nt, pf, m, e] = results;
    setReminders(rem.status === "fulfilled" ? rem.value.reminders || [] : []);
    if (nt.status === "fulfilled") setUnreadCount(nt.value.unread_count || 0);
    setPosts(pf.status === "fulfilled" ? pf.value.posts || [] : []);
    setMatches(m.status === "fulfilled" ? m.value.matches || [] : []);
    setEvents(e.status === "fulfilled" ? e.value.events || [] : []);
    const labels = ["reminders", "activity", "posts", "people", "events"];
    const failed = results.flatMap((result, index) => result.status === "rejected" ? [labels[index]] : []);
    setLoadError(failed.length ? `Couldn't load ${failed.join(", ")}. Pull down to retry.` : "");
    setLoadedMode(feedMode);
    setClock(new Date());
    setRefreshing(false);
  }, [feedMode]);

  useFocusEffect(useCallback(() => {
    void load();
    const timer = setInterval(() => setClock(new Date()), 60000);
    return () => { requestId.current += 1; clearInterval(timer); };
  }, [load]));

  const selectFeedMode = (mode: typeof feedMode) => {
    setFeedMode(mode);
    setVisibleCount(12);
  };

  const dismissReminder = async (eventId: string) => {
    setReminders((r) => r.filter((x) => x.id !== eventId));
    try { await api.dismissReminder(eventId); } catch {}
  };

  const fmtMins = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ""}`);
  const topMatch = matches[0];
  const interests = useMemo<string[]>(() => (user as any)?.interests || [], [user]);
  const eventCards = useMemo(() => feedMode === "for_you" ? rankHomeEvents(events, interests, clock) : [], [feedMode, events, interests, clock]);
  const feed = useMemo(() => mixHomeFeed(posts, eventCards), [posts, eventCards]);
  const visibleFeed = feed.slice(0, visibleCount);
  const standaloneReminder = reminders.find(reminder => !eventCards.some(card => card.event.id === reminder.id));
  const ready = loadedMode === feedMode;

  const renderEvent = ({ event, kind, reason }: HomeEventCard) => {
    const reminder = reminders.find(item => item.id === event.id);
    const label = kind === "going" ? "YOU'RE GOING" : kind === "interested" ? "YOU'RE INTERESTED" : kind === "recommended" ? "PICKED FOR YOU" : "AROUND CAMPUS";
    return <View style={styles.eventOpportunity}>
      <Pressable onPress={() => router.push(`/event/${event.id}`)} testID={`home-event-${event.id}`} accessibilityRole="button" accessibilityLabel={`${event.title}. ${label}. View event details`}>
        <View style={styles.opportunityTop}>
          <Text style={styles.opportunityKicker}>{label}</Text>
          <Icon name={kind === "going" ? "checkmark-circle" : kind === "interested" ? "star" : "calendar-outline"} size={18} color={themeColors.brandPrimary} />
        </View>
        <View style={styles.eventOpportunityRow}>
          {event.cover_image_url ? <Image source={{ uri: event.cover_image_url }} style={styles.eventThumb} contentFit="cover" /> : <View style={styles.eventThumbFallback}><Icon name="calendar-outline" size={22} color={themeColors.brandPrimary} /></View>}
          <View style={styles.eventBody}>
            <Text numberOfLines={2} style={styles.eventName}>{event.title}</Text>
            <Text style={styles.eventDate}>{eventDayLabel(event.date, clock)}{event.time ? ` · ${event.time}` : ""}</Text>
            {!!event.location && <Text numberOfLines={1} style={styles.opportunityReason}>{event.location}</Text>}
          </View>
        </View>
        <Text style={styles.eventReason}>{reason}</Text>
        <View style={styles.eventFooter}>
          <Text style={styles.eventAction}>{kind === "going" ? "View your plan" : kind === "interested" ? "See who's going" : "See event & join"} →</Text>
          {(event.going_count || 0) > 0 && <Text style={styles.eventAttendance}>{event.going_count} going</Text>}
        </View>
      </Pressable>
      {reminder && <View style={styles.eventReminder}>
        <Icon name="time-outline" size={15} color={themeColors.brandPrimary} />
        <Text style={styles.eventReminderText}>Starts in {fmtMins(reminder.starts_in_minutes)}</Text>
        <Pressable onPress={() => void dismissReminder(event.id)} hitSlop={10} accessibilityLabel="Dismiss event reminder" accessibilityRole="button"><Icon name="close" size={17} color={themeColors.muted} /></Pressable>
      </View>}
    </View>;
  };
  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} tintColor={themeColors.brandPrimary} />}
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

        <View style={styles.feedTabs}>
          <View style={styles.feedTabGroup}>
            <Pressable onPress={() => selectFeedMode("for_you")} style={[styles.feedTab, feedMode === "for_you" && styles.feedTabActive]}><Text style={[styles.feedTabText, feedMode === "for_you" && styles.feedTabTextActive]}>For You</Text></Pressable>
            <Pressable onPress={() => selectFeedMode("connections")} style={[styles.feedTab, feedMode === "connections" && styles.feedTabActive]}><Text style={[styles.feedTabText, feedMode === "connections" && styles.feedTabTextActive]}>Connections</Text></Pressable>
          </View>
          <Pressable onPress={() => setCreateMenuOpen(true)} style={styles.feedCreate} testID="home-create-menu"><Icon name="add" size={26} color={themeColors.onSurface} /></Pressable>
        </View>
        <View style={styles.feed}>
          {ready && !!loadError && <Text style={styles.feedError} accessibilityLiveRegion="polite">{loadError}</Text>}
          {!ready ? <View style={styles.feedLoading}><ActivityIndicator color={themeColors.brandPrimary} /><Text style={styles.feedEmptyText}>Finding what's happening...</Text></View> : <>
            {standaloneReminder && <View style={styles.feedSignal}>
              <Pressable onPress={() => router.push(`/event/${standaloneReminder.id}`)} style={styles.signalBody} testID={`reminder-${standaloneReminder.id}`}>
                <Text style={styles.signalKicker}>COMING UP</Text>
                <Text style={styles.signalTitle}>Starts in {fmtMins(standaloneReminder.starts_in_minutes)} · {standaloneReminder.title}</Text>
                <Text numberOfLines={1} style={styles.signalMeta}>{standaloneReminder.time} · {standaloneReminder.location}</Text>
              </Pressable>
              <Pressable onPress={() => void dismissReminder(standaloneReminder.id)} hitSlop={10} accessibilityLabel="Dismiss event reminder"><Icon name="close" size={17} color={themeColors.muted} /></Pressable>
            </View>}
            {feed.length === 0 && !refreshing && !loadError ? (
              <View style={styles.feedEmpty}>
                <Icon name="chatbubbles-outline" size={30} color={themeColors.brandPrimary} />
                <Text style={styles.feedEmptyTitle}>{feedMode === "connections" ? "Your connections are quiet" : "Campus is quiet right now"}</Text>
                <Text style={styles.feedEmptyText}>Start something, make a plan, or find people who are down.</Text>
                <Pressable onPress={() => setCreateMenuOpen(true)} style={styles.emptyAction}><Text style={styles.emptyActionText}>Start something</Text></Pressable>
              </View>
            ) : <>
              {visibleFeed.map((item, index) => {
                const post = item.type === "post" ? item.post : null;
                const actionable = post && ["anyone_down", "looking_for_people"].includes(post.intent);
                return <View key={item.key}>
                  {item.type === "event" ? renderEvent(item.card) : post && (
                    <Pressable onPress={() => router.push(`/post/${post.id}`)} style={styles.feedPost}>
                      <Avatar uri={post.author?.profile_photo_url} name={post.author?.first_name} size={42} />
                      <View style={styles.feedPostBody}>
                        <View style={styles.feedPostTop}>
                          <Text style={styles.feedPostName}>{post.author?.first_name} {post.author?.last_name}</Text>
                          <Text style={styles.feedPostIntent}>{post.intent === "anyone_down" ? "Anyone down?" : post.intent === "looking_for_people" ? "Looking for people" : post.intent === "question" ? "Question" : post.intent === "recommendation" ? "Recommendation" : post.intent === "event" ? "Event" : "Post"}</Text>
                        </View>
                        <Text style={styles.feedPostText}>{post.content}</Text>
                        <View style={styles.feedPostActions}>
                          <Icon name="chatbubble-outline" size={15} color={themeColors.muted} />
                          {actionable && <><Icon name="people-outline" size={16} color={themeColors.brandPrimary} /><Text style={styles.feedDown}>{post.interest_count || 0} down</Text></>}
                        </View>
                      </View>
                    </Pressable>
                  )}
                  {feedMode === "for_you" && topMatch && index === Math.min(2, visibleFeed.length - 1) && (
                    <Pressable onPress={() => router.push(`/match/${topMatch.user.id}`)} style={styles.personOpportunity} testID="home-person-for-you">
                        <View style={styles.opportunityTop}>
                          <Text style={styles.opportunityKicker}>PERSON FOR YOU</Text>
                          <Text style={styles.matchPercent}>{topMatch.compatibility}% match</Text>
                        </View>
                        <View style={styles.personRow}>
                          <Avatar uri={topMatch.user.profile_photo_url} name={topMatch.user.first_name} size={58} />
                          <View style={styles.personBody}>
                            <Text style={styles.personName}>{topMatch.user.first_name} {topMatch.user.last_name}</Text>
                            <Text numberOfLines={2} style={styles.opportunityReason}>
                              {(topMatch.reasons || []).slice(0, 2).join(" · ") || [topMatch.user.major, topMatch.user.year].filter(Boolean).join(" · ") || "Someone Circle thinks you may click with"}
                            </Text>
                          </View>
                          <Icon name="arrow-forward" size={20} color={themeColors.brandPrimary} />
                        </View>
                      </Pressable>
                  )}
                </View>;
              })}
              {feed.length > visibleCount ? <Pressable onPress={() => setVisibleCount(count => count + 12)} style={styles.showMore} accessibilityRole="button"><Text style={styles.exploreLink}>{feedMode === "for_you" ? "Show more posts & events" : "Show more posts"}</Text><Icon name="chevron-down" size={18} color={themeColors.brandPrimary} /></Pressable> : feed.length > 0 && <View style={styles.caughtUp}>
                <View style={styles.caughtIcon}><Icon name="checkmark" size={18} color={themeColors.brandPrimary} /></View>
                <Text style={styles.caughtTitle}>You're caught up</Text>
                <Text style={styles.caughtText}>See what else is happening around campus.</Text>
                <Pressable onPress={() => router.push("/(tabs)/discover")}><Text style={styles.exploreLink}>Explore campus →</Text></Pressable>
              </View>}
            </>}
          </>}
        </View>
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

  feedTabs: { height: 48, marginHorizontal: spacing.xl, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: colors.divider },
  feedTabGroup: { height: "100%", flexDirection: "row", alignItems: "stretch" },
  feedTab: { justifyContent: "center", marginRight: 26, paddingHorizontal: 1 },
  feedTabActive: { borderBottomWidth: 2, borderBottomColor: colors.brandPrimary },
  feedTabText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  feedTabTextActive: { color: colors.onSurface, fontWeight: "900" },
  feedCreate: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },

  feed: { paddingHorizontal: spacing.xl },
  feedPost: { flexDirection: "row", gap: 11, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: colors.divider },
  feedPostBody: { flex: 1 },
  feedPostTop: { flexDirection: "row", alignItems: "center", gap: 7 },
  feedPostName: { flexShrink: 1, color: colors.onSurface, fontSize: 14, fontWeight: "900" },
  feedPostIntent: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800" },
  feedPostText: { color: colors.onSurface, fontSize: 15, lineHeight: 21, marginTop: 6 },
  feedPostActions: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 10 },
  feedDown: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800" },

  opportunityTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 11 },
  opportunityKicker: { color: colors.brandPrimary, fontSize: 9, fontWeight: "900", letterSpacing: 1.05 },
  personOpportunity: { marginVertical: 10, padding: 15, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider },
  personRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  personBody: { flex: 1, minWidth: 0 },
  personName: { color: colors.onSurface, fontSize: 17, fontWeight: "900" },
  matchPercent: { color: colors.brandPrimary, fontSize: 12, fontWeight: "900" },
  opportunityReason: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  eventOpportunity: { marginVertical: 10, padding: 15, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider },
  eventOpportunityRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  eventThumb: { width: 68, height: 68, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  eventThumbFallback: { width: 68, height: 68, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  eventBody: { flex: 1, minWidth: 0 },
  eventName: { color: colors.onSurface, fontSize: 16, fontWeight: "900" },
  eventWhen: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  eventDate: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700", marginTop: 5 },
  eventReason: { color: colors.muted, fontSize: 12, lineHeight: 18, marginTop: 12 },
  eventFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  eventAttendance: { color: colors.muted, fontSize: 11, marginTop: 7 },
  eventReminder: { flexDirection: "row", alignItems: "center", gap: 7, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 12, paddingTop: 12 },
  eventReminderText: { flex: 1, color: colors.brandPrimary, fontSize: 12, fontWeight: "700" },
  feedLoading: { paddingVertical: 48, alignItems: "center", gap: 12 },
  feedError: { color: colors.error, fontSize: 12, lineHeight: 18, paddingVertical: 12 },
  showMore: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  eventAction: { color: colors.brandPrimary, fontSize: 12, fontWeight: "900", marginTop: 7 },

    feedSignal: { flexDirection: "row", alignItems: "center", gap: 11, marginVertical: 8, paddingVertical: 13, paddingHorizontal: 12, borderRadius: radius.lg, backgroundColor: colors.brandTertiary },
  signalIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  signalBody: { flex: 1, minWidth: 0 },
  signalKicker: { color: colors.brandPrimary, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  signalTitle: { color: colors.onSurface, fontSize: 13, fontWeight: "800", marginTop: 2 },
  signalMeta: { color: colors.muted, fontSize: 11, marginTop: 2 },

  feedEmpty: { alignItems: "center", paddingVertical: 72, paddingHorizontal: 28 },
  feedEmptyTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "900", marginTop: 12 },
  feedEmptyText: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 5 },
  emptyAction: { marginTop: spacing.lg, backgroundColor: colors.brandPrimary, paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.pill },
  emptyActionText: { color: colors.onBrandPrimary, fontSize: 13, fontWeight: "800" },

  caughtUp: { alignItems: "center", paddingTop: 42, paddingBottom: 26 },
  caughtIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  caughtTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "900", marginTop: 10 },
  caughtText: { color: colors.muted, fontSize: 12, marginTop: 3 },
  exploreLink: { color: colors.brandPrimary, fontSize: 13, fontWeight: "800", marginTop: 10, paddingVertical: 5 },

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

