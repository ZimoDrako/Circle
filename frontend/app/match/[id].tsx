import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Image } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius, useTheme, makeStyles } from "@/src/theme";
import { Avatar, Button, Chip } from "@/src/ui";
import { api } from "@/src/api";
import { MainTabBar } from "@/src/components/main-tab-bar";

export default function MatchDetail() {
  const { colors: themeColors, scheme } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [connecting, setConnecting] = useState(false);
  const [interestsOpen, setInterestsOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);
  const [profileCircles, setProfileCircles] = useState<any[]>([]);
  const [profileTab, setProfileTab] = useState<"interests" | "events" | "posts" | "circles">("interests");
  const [matchOpen, setMatchOpen] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [profile, conns, circles, eventData, postData] = await Promise.all([
        api.getUser(id!),
        api.getUserConnections(id!),
        api.getUserProfileCircles(id!),
        api.listEvents(),
        api.listPosts(id!),
      ]);
      setData(profile);
      setConnections(conns.connections || []);
      setProfileCircles(circles.circles || []);
      setEvents((eventData.events || []).filter((e: any) => e.creator_id === id));
      setPosts(postData.posts || []);
    } catch {}
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!data) return <SafeAreaView style={styles.root}><Text style={styles.loading}>Loading profile...</Text></SafeAreaView>;
  const u = data.user;
  const interestIcon = (label: string) => {
    const s = label.toLowerCase();
    if (/music|concert|rap|r&b|jazz/.test(s)) return "musical-notes";
    if (/game|gaming|esport/.test(s)) return "game-controller";
    if (/photo|camera/.test(s)) return "camera";
    if (/food|cook|restaurant/.test(s)) return "restaurant";
    if (/gym|fitness|workout|sport/.test(s)) return "barbell";
    if (/hike|outdoor|travel|explore/.test(s)) return "trail-sign";
    if (/movie|film|anime|manga/.test(s)) return "film";
    if (/fashion|style/.test(s)) return "shirt";
    if (/tech|coding|software|ai/.test(s)) return "code-slash";
    if (/art|design/.test(s)) return "color-palette";
    if (/book|read/.test(s)) return "book";
    if (/coffee|cafe/.test(s)) return "cafe";
    return "sparkles";
  };
  const conn = data.connection ?? { status: "none" };
  const sharedNorm = new Set((data.shared_interests || []).map((x: string) => x.trim().toLowerCase()));
  const sortedInterests = [...(u.interests || [])].sort((a: string, b: string) => Number(sharedNorm.has(b.trim().toLowerCase())) - Number(sharedNorm.has(a.trim().toLowerCase())));
  const preview = sortedInterests.slice(0, 4);

  const onConnect = async () => {
    setConnecting(true);
    try {
      if (conn.status === "connected" && conn.circle_id) { router.push(`/circle/${conn.circle_id}`); return; }
      const r = conn.status === "pending_in" ? await api.acceptConnection(conn.id) : await api.requestConnection(id!);
      setData((d: any) => ({ ...d, connection: r.connection, connection_count: r.connection.status === "connected" ? (d.connection_count || 0) + 1 : d.connection_count }));
      if (r.connection.status === "connected" && r.connection.circle_id) router.push(`/circle/${r.connection.circle_id}`);
    } catch {} finally { setConnecting(false); }
  };
  const connectLabel = conn.status === "connected" ? "Message" : conn.status === "pending_in" ? "Accept & chat" : conn.status === "pending_out" ? "Requested" : "Connect";

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safeTop}>
        <View style={styles.header}><Pressable onPress={() => router.back()} testID="match-back" style={styles.headerBtn}><Icon name="chevron-back" size={25} color={themeColors.onSurface} /></Pressable><Text style={styles.headerTitle}>Profile</Text><View style={{ width: 37 }} /></View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.banner}>{u.banner_image_url ? <Image source={{ uri: u.banner_image_url }} style={styles.bannerImage} /> : <View style={styles.bannerFallback} />}</View>
          <Avatar uri={u.profile_photo_url} name={u.first_name} size={108} />
          <View style={styles.identity}>
            <View style={styles.nameRow}><Text style={styles.name}>{u.first_name} {u.last_name}</Text>{u.verified && <Icon name="checkmark-circle" size={20} color={themeColors.brandPrimary} />}</View>
            <Text style={styles.meta}>{u.university || "Student"}</Text>
            <Text style={styles.meta}>{[u.major, u.year].filter(Boolean).join(" · ") || "Student"}</Text>
            <Text style={styles.profileBio}>{u.bio || `${u.first_name} hasn't added a bio yet.`}</Text>
          </View>
          <Pressable style={styles.matchBadge} onPress={() => setMatchOpen(true)} testID="match-score">
            <View style={styles.matchTrack}>
              <View style={[styles.matchFill, { height: `${Math.max(0, Math.min(100, data.compatibility || 0))}%` }]} />
            </View>
            <View style={styles.matchInner}>
              <Text style={styles.matchScore}>{data.compatibility}%</Text>
              <Text style={styles.matchLabel}>Match</Text>
            </View>
          </Pressable>
        </View>

        <View style={styles.actions}>
          <Button label={connectLabel} onPress={onConnect} loading={connecting} disabled={conn.status === "pending_out"} style={{ flex: 1 }} testID="match-connect" />
        </View>

        <View style={styles.metrics}>
          <Pressable style={styles.metric} onPress={() => setConnectionsOpen(true)}>
            <Text style={styles.metricNum}>{data.connection_count || 0}</Text><Text style={styles.metricLabel}>Connections</Text>
          </Pressable>
          <View style={styles.metricDivider} />
          <Pressable style={styles.metric} onPress={() => setProfileTab("circles")}>
            <Text style={styles.metricNum}>{data.circle_count || 0}</Text><Text style={styles.metricLabel}>Circles</Text>
          </Pressable>
        </View>

        <View style={styles.profileTabs}>
          {([["interests","Interests"],["events","Events"],["posts","Posts"],["circles","Circles"]] as const).map(([key,label]) => (
            <Pressable key={key} style={styles.profileTab} onPress={() => setProfileTab(key)}>
              <Text style={[styles.profileTabText, profileTab === key && styles.profileTabTextActive]}>{label}</Text>
              {profileTab === key && <View style={styles.profileTabLine} />}
            </Pressable>
          ))}
        </View>

        {profileTab === "interests" && <>
        <Pressable style={styles.plainSection} onPress={() => setInterestsOpen(true)}>
          <View style={styles.cardHeader}>
            <View><Text style={styles.cardTitle}>Interests</Text><Text style={styles.cardSub}>{data.shared_interests?.length || 0} in common · {u.interests?.length || 0} total</Text></View>
            <Icon name="chevron-forward" size={20} color={themeColors.brandPrimary} />
          </View>
          <View style={styles.previewRow}>{preview.map((i: string) => { const shared = sharedNorm.has(i.trim().toLowerCase()); return <View key={i} style={styles.previewTile}><View style={[styles.interestEmblem, shared && styles.interestShared]}><Icon name={interestIcon(i) as any} size={20} color={shared ? colors.onBrandPrimary : colors.brandPrimary} /></View><Text numberOfLines={1} style={styles.interestName}>{i}</Text>{shared && <Text style={styles.sharedLabel}>Both</Text>}</View>; })}{sortedInterests.length > 4 && <View style={styles.previewTile}><View style={styles.interestEmblem}><Text style={styles.moreText}>+{sortedInterests.length - 4}</Text></View><Text style={styles.interestName}>More</Text></View>}</View>
        </Pressable>

        {(u.looking_for || []).length > 0 && <View style={styles.plainSection}><View style={styles.cardHeader}><Text style={styles.cardTitle}>Looking for</Text><Icon name="search-outline" size={18} color={themeColors.brandPrimary} /></View><View style={styles.lookingWrap}>{u.looking_for.map((item: string, i: number) => <View key={item} style={[styles.lookingTag, styles[`lookingTag${i % 5}` as keyof typeof styles] as any]}><Text style={[styles.lookingText, scheme === "dark" && { color: "#FFFFFF" }]}>{item}</Text></View>)}</View></View>}
        </>}

        {profileTab === "events" && <View style={styles.circlesSection}>
          {events.length === 0 ? <View style={styles.circleEmpty}><Icon name="calendar-outline" size={38} color={themeColors.brandPrimary} /><Text style={styles.circleEmptyTitle}>No events shown</Text><Text style={styles.circleEmptyText}>{u.first_name} hasn't created any events yet.</Text></View> : events.map((event: any) => (
            <Pressable key={event.id} style={styles.circleRow} onPress={() => router.push(`/event/${event.id}`)}>
              <View style={styles.circleIcon}><Icon name="calendar" size={21} color={themeColors.brandPrimary} /></View>
              <View style={{ flex: 1 }}><Text style={styles.circleName}>{event.title}</Text><Text numberOfLines={1} style={styles.circleMeta}>{[event.date, event.time, event.location].filter(Boolean).join(" · ")}</Text></View>
              <Icon name="chevron-forward" size={18} color={themeColors.muted} />
            </Pressable>
          ))}
        </View>}

        {profileTab === "posts" && <View style={styles.circlesSection}>
          {posts.length === 0 ? <View style={styles.circleEmpty}><Icon name="chatbubble-ellipses-outline" size={38} color={themeColors.brandPrimary} /><Text style={styles.circleEmptyTitle}>No posts yet</Text><Text style={styles.circleEmptyText}>{u.first_name} hasn't posted anything visible to you.</Text></View> : posts.map((post: any) => (
            <Pressable key={post.id} style={styles.postCard} onPress={() => router.push(`/post/${post.id}`)}>
              <View style={styles.postHead}><Avatar uri={u.profile_photo_url} name={u.first_name} size={38} /><View style={{ flex: 1 }}><Text style={styles.circleName}>{u.first_name} {u.last_name}</Text><Text style={styles.circleMeta}>{post.intent === "anyone_down" ? "Anyone down?" : post.intent === "looking_for_people" ? "Looking for people" : post.intent === "question" ? "Question" : post.intent === "recommendation" ? "Recommendation" : "Post"}</Text></View></View>
              <Text style={styles.postText}>{post.content}</Text>
            </Pressable>
          ))}
        </View>}

        {profileTab === "circles" && <View style={styles.circlesSection}>
          {profileCircles.length === 0 ? (
            <View style={styles.circleEmpty}>
              <Icon name="people-circle-outline" size={38} color={themeColors.brandPrimary} />
              <Text style={styles.circleEmptyTitle}>No Circles shown</Text>
              <Text style={styles.circleEmptyText}>{u.first_name} hasn't chosen any Circles to display on their profile.</Text>
            </View>
          ) : profileCircles.map((circle: any) => (
            <Pressable key={circle.id} style={styles.circleRow} onPress={() => router.push(`/circle/${circle.id}`)}>
              <View style={styles.circleIcon}><Icon name="people" size={22} color={themeColors.brandPrimary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.circleName}>{circle.name}</Text>
                <Text numberOfLines={1} style={styles.circleMeta}>{(circle.interests || []).slice(0, 3).join(" · ") || `${(circle.member_ids || []).length} members`}</Text>
              </View>
              <View style={styles.privateBadge}><Icon name="lock-closed-outline" size={13} color={themeColors.brandPrimary} /><Text style={styles.privateBadgeText}>Chat private</Text></View>
              <Icon name="chevron-forward" size={18} color={themeColors.muted} />
            </Pressable>
          ))}
        </View>}

        {conn.status === "pending_in" && <View style={styles.pending}><Icon name="mail-unread-outline" size={17} color={themeColors.brandPrimary} /><Text style={styles.pendingText}>{u.first_name} wants to connect with you</Text></View>}
      </ScrollView>

      <Modal visible={matchOpen} transparent animationType="fade" onRequestClose={() => setMatchOpen(false)}>
        <Pressable style={styles.matchOverlay} onPress={() => setMatchOpen(false)}>
          <Pressable style={styles.matchSheet} onPress={() => {}}>
            <View style={styles.matchSheetTop}><View style={styles.matchSheetIcon}><Icon name="sparkles" size={22} color={themeColors.brandPrimary} /></View><View style={{ flex: 1 }}><Text style={styles.matchSheetTitle}>{data.compatibility}% match</Text><Text style={styles.matchSheetSub}>Why you and {u.first_name} may click</Text></View><Pressable onPress={() => setMatchOpen(false)}><Icon name="close" size={24} color={themeColors.onSurface} /></Pressable></View>
            {(data.reasons || []).slice(0, 5).map((reason: string, i: number) => <View key={i} style={styles.matchReason}><Icon name="checkmark-circle" size={18} color={themeColors.brandPrimary} /><Text style={styles.matchReasonText}>{reason}</Text></View>)}
            {!(data.reasons || []).length && <Text style={styles.matchReasonText}>Circle will show more match reasons as you use the app.</Text>}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={connectionsOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setConnectionsOpen(false)}>
        <SafeAreaView style={styles.modalRoot}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{u.first_name}'s connections</Text><Pressable onPress={() => setConnectionsOpen(false)}><Icon name="close" size={26} color={themeColors.onSurface} /></Pressable></View><ScrollView contentContainerStyle={styles.modalContent}>{connections.length === 0 ? <Text style={styles.empty}>No connections yet.</Text> : connections.map((c: any) => <Pressable key={c.id} style={styles.personRow} onPress={() => { setConnectionsOpen(false); router.push(`/match/${c.user.id}`); }}><Avatar uri={c.user.profile_photo_url} name={c.user.first_name} size={48} /><View style={{ flex: 1 }}><Text style={styles.personName}>{c.user.first_name} {c.user.last_name}</Text><Text style={styles.personMeta}>{[c.user.major, c.user.year].filter(Boolean).join(" · ")}</Text></View><Icon name="chevron-forward" size={18} color={themeColors.muted} /></Pressable>)}</ScrollView></SafeAreaView>
      </Modal>

      <Modal visible={interestsOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setInterestsOpen(false)}>
        <SafeAreaView style={styles.modalRoot}><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>Interests</Text><Text style={styles.cardSub}>Shared interests are highlighted</Text></View><Pressable onPress={() => setInterestsOpen(false)}><Icon name="close" size={26} color={themeColors.onSurface} /></Pressable></View><ScrollView contentContainerStyle={styles.modalContent}><View style={styles.interestGrid}>{sortedInterests.map((i: string) => { const shared = sharedNorm.has(i.trim().toLowerCase()); return <View key={i} style={styles.interestTile}><View style={[styles.interestEmblem, shared && styles.interestShared]}><Icon name={interestIcon(i) as any} size={20} color={shared ? colors.onBrandPrimary : colors.brandPrimary} /></View><Text numberOfLines={1} style={styles.interestName}>{i}</Text>{shared && <Text style={styles.sharedLabel}>Both</Text>}</View>; })}</View></ScrollView></SafeAreaView>
      </Modal>

      <MainTabBar />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface }, safeTop: { backgroundColor: colors.surface }, loading: { padding: 24, color: colors.muted },
  header: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg }, headerBtn: { padding: 6 }, headerTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  content: { paddingBottom: 36 }, hero: { minHeight: 300, paddingHorizontal: spacing.xl, paddingTop: 150, paddingBottom: spacing.xl, backgroundColor: colors.surface, overflow: "hidden" },
  banner: { position: "absolute", top: 0, left: 0, right: 0, height: 185, backgroundColor: colors.brandTertiary }, bannerImage: { width: "100%", height: "100%" }, bannerFallback: { flex: 1, backgroundColor: colors.brandTertiary }, identity: { marginTop: spacing.md, paddingRight: 92 }, nameRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" }, name: { fontSize: 25, fontWeight: "900", color: colors.onSurface }, meta: { color: colors.muted, fontSize: 13, marginTop: 3 }, profileBio: { color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 18, marginTop: 9, maxWidth: 255 },
  matchBadge: { position: "absolute", right: spacing.xl, bottom: spacing.xl, width: 82, height: 82, borderRadius: 41, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }, matchTrack: { ...StyleSheet.absoluteFill, borderRadius: 41, overflow: "hidden", backgroundColor: colors.brandTertiary, justifyContent: "flex-end" }, matchFill: { width: "100%", backgroundColor: colors.brandPrimary }, matchInner: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }, matchScore: { color: colors.onSurface, fontWeight: "900", fontSize: 17 }, matchLabel: { color: colors.muted, fontWeight: "800", fontSize: 9, marginTop: 1 },
  actions: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.xl }, metrics: { marginHorizontal: spacing.xl, marginTop: spacing.lg, flexDirection: "row", alignItems: "center", paddingVertical: spacing.md, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.divider }, metric: { flex: 1, alignItems: "center" }, metricNum: { color: colors.onSurface, fontSize: 18, fontWeight: "900" }, metricLabel: { color: colors.muted, fontSize: 11, marginTop: 2 }, metricDivider: { width: 1, height: 28, backgroundColor: colors.divider },
  profileTabs: { flexDirection: "row", marginTop: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider }, profileTab: { flex: 1, alignItems: "center", paddingVertical: 12, position: "relative" }, profileTabText: { color: colors.muted, fontSize: 13, fontWeight: "800" }, profileTabTextActive: { color: colors.onSurface }, profileTabLine: { position: "absolute", left: "24%", right: "24%", bottom: -1, height: 2, borderRadius: 2, backgroundColor: colors.brandPrimary },
  plainSection: { marginHorizontal: spacing.xl, paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider }, card: { marginHorizontal: spacing.xl, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }, cardTitle: { color: colors.onSurface, fontWeight: "800", fontSize: 17 }, cardSub: { color: colors.muted, fontSize: 12, marginTop: 2 }, bio: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  detailRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }, detailPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill }, detailText: { fontSize: 12, color: colors.onSurfaceSecondary, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  previewRow: { flexDirection: "row", justifyContent: "space-between", gap: 3, marginTop: spacing.md }, previewTile: { flex: 1, minWidth: 0, maxWidth: "20%", alignItems: "center", gap: 5, paddingVertical: 4 }, interestGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: spacing.md }, interestTile: { width: "30%", minWidth: 86, alignItems: "center", gap: 5, paddingVertical: 8 }, interestEmblem: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }, interestShared: { backgroundColor: colors.brandPrimary }, interestName: { color: colors.onSurface, fontSize: 11, fontWeight: "700", maxWidth: 88, textAlign: "center" }, sharedLabel: { color: colors.brandPrimary, fontSize: 9, fontWeight: "900", textTransform: "uppercase" }, more: { minWidth: 42, height: 34, paddingHorizontal: 10, borderRadius: 17, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" }, moreText: { color: colors.onSurface, fontWeight: "800", fontSize: 12 },
  youTwo: { marginHorizontal: spacing.xl, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.brandTertiary }, youTitle: { flexDirection: "row", alignItems: "center", gap: 7 }, youScore: { color: colors.brandPrimary, fontSize: 14, fontWeight: "900" }, reason: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md }, reasonText: { color: colors.onBrandTertiary, fontSize: 13, flex: 1 },
  lookingWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.md }, lookingTag: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.pill }, lookingTag0: { backgroundColor: "#E8F1FF" }, lookingTag1: { backgroundColor: "#F0E9FF" }, lookingTag2: { backgroundColor: "#FFE9EF" }, lookingTag3: { backgroundColor: "#E8F7EF" }, lookingTag4: { backgroundColor: "#FFF0F3" }, lookingText: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "700" },
  compactCard: { marginHorizontal: spacing.xl, marginTop: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary }, compactTitle: { color: colors.onSurface, fontWeight: "800" }, compactValue: { color: colors.muted, fontSize: 12, flex: 1, textAlign: "right" }, pending: { marginHorizontal: spacing.xl, marginTop: spacing.lg, flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandTertiary }, pendingText: { color: colors.onBrandTertiary, fontWeight: "700", flex: 1 },
  postCard: { paddingVertical: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider }, postHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm }, postText: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20, marginTop: spacing.md },
  matchOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,.38)", justifyContent: "flex-end" }, matchSheet: { backgroundColor: colors.surface, padding: spacing.xl, paddingBottom: 36, borderTopLeftRadius: 28, borderTopRightRadius: 28 }, matchSheetTop: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.lg }, matchSheetIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }, matchSheetTitle: { color: colors.onSurface, fontSize: 22, fontWeight: "900" }, matchSheetSub: { color: colors.muted, fontSize: 12, marginTop: 2 }, matchReason: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 9 }, matchReasonText: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20, flex: 1 },
  circlesSection: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.sm }, circleEmpty: { alignItems: "center", paddingVertical: 48, paddingHorizontal: spacing.xl }, circleEmptyTitle: { marginTop: spacing.md, color: colors.onSurface, fontSize: 17, fontWeight: "900" }, circleEmptyText: { marginTop: 6, color: colors.muted, fontSize: 12, lineHeight: 18, textAlign: "center" }, circleRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider }, circleIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary }, circleName: { color: colors.onSurface, fontSize: 15, fontWeight: "900" }, circleMeta: { color: colors.muted, fontSize: 12, marginTop: 3 }, privateBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.brandTertiary }, privateBadgeText: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800" },
  modalRoot: { flex: 1, backgroundColor: colors.surface }, modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.divider }, modalTitle: { fontSize: 22, fontWeight: "900", color: colors.onSurface }, modalContent: { padding: spacing.xl, paddingBottom: 50 }, empty: { color: colors.muted, textAlign: "center", marginTop: spacing.xxxl }, personRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider }, personName: { color: colors.onSurface, fontSize: 15, fontWeight: "800" }, personMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
}));
