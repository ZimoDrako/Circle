import { useCallback, useState } from "react";
import { View, Text, ScrollView, Pressable, RefreshControl, Modal } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { spacing, radius, useTheme, makeStyles } from "@/src/theme";
import { Avatar } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function Home() {
  const { colors: themeColors } = useTheme();
  const styles = useStyles();
  const { user } = useAuth();
  const router = useRouter();
  const [reminders, setReminders] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [posts, setPosts] = useState<any[]>([]);
  const [feedMode, setFeedMode] = useState<"for_you" | "connections">("for_you");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [rem, nt, pf] = await Promise.all([
        api.reminders(),
        api.notifications(),
        api.listPosts(undefined, feedMode),
      ]);
      setReminders(rem.reminders || []);
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
            <Pressable onPress={() => setFeedMode("for_you")} style={[styles.feedTab, feedMode === "for_you" && styles.feedTabActive]}><Text style={[styles.feedTabText, feedMode === "for_you" && styles.feedTabTextActive]}>For You</Text></Pressable>
            <Pressable onPress={() => setFeedMode("connections")} style={[styles.feedTab, feedMode === "connections" && styles.feedTabActive]}><Text style={[styles.feedTabText, feedMode === "connections" && styles.feedTabTextActive]}>Connections</Text></Pressable>
          </View>
          <Pressable onPress={() => setCreateMenuOpen(true)} style={styles.feedCreate} testID="home-create-menu"><Icon name="add" size={26} color={themeColors.onSurface} /></Pressable>
        </View>
        <View style={styles.feed}>
          {posts.length === 0 ? (
            <View style={styles.feedEmpty}>
              <Icon name="chatbubbles-outline" size={30} color={themeColors.brandPrimary} />
              <Text style={styles.feedEmptyTitle}>{feedMode === "connections" ? "Your connections are quiet" : "Campus is quiet right now"}</Text>
              <Text style={styles.feedEmptyText}>Start something, make a plan, or find people who are down.</Text>
              <Pressable onPress={() => setCreateMenuOpen(true)} style={styles.emptyAction}><Text style={styles.emptyActionText}>Start something</Text></Pressable>
            </View>
          ) : (
            <>
              {posts.map((post:any, index:number) => {
                const actionable = ["anyone_down","looking_for_people"].includes(post.intent);
                return (
                  <View key={post.id}>
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
                    {index === 1 && reminders.length > 0 && (() => {
                      const r = reminders[0];
                      return (
                        <Pressable testID={`reminder-${r.id}`} onPress={() => router.push(`/event/${r.id}`)} style={styles.feedSignal}>
                          <View style={styles.signalIcon}><Icon name="time-outline" size={19} color={themeColors.brandPrimary} /></View>
                          <View style={styles.signalBody}>
                            <Text style={styles.signalKicker}>COMING UP</Text>
                            <Text style={styles.signalTitle}>Starts in {fmtMins(r.starts_in_minutes)} · {r.title}</Text>
                            <Text numberOfLines={1} style={styles.signalMeta}>{r.time} · {r.location}</Text>
                          </View>
                          <Pressable onPress={() => dismissReminder(r.id)} hitSlop={10}><Icon name="close" size={17} color={themeColors.muted} /></Pressable>
                        </Pressable>
                      );
                    })()}
                  </View>
                );
              })}
              <View style={styles.caughtUp}>
                <View style={styles.caughtIcon}><Icon name="checkmark" size={18} color={themeColors.brandPrimary} /></View>
                <Text style={styles.caughtTitle}>You're caught up</Text>
                <Text style={styles.caughtText}>See what else is happening around campus.</Text>
                <Pressable onPress={() => router.push("/(tabs)/discover")}><Text style={styles.exploreLink}>Explore campus →</Text></Pressable>
              </View>
            </>
          )}
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
