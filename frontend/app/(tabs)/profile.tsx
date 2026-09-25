import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Image } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import * as ImagePicker from "expo-image-picker";
import { colors, spacing, radius } from "@/src/theme";
import { Avatar, Button, Chip } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function Profile() {
  const { user, refresh, signOut } = useAuth();
  const router = useRouter();
  const [verifying, setVerifying] = useState(false);
  const [circleCount, setCircleCount] = useState(0);
  const [myCircles, setMyCircles] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [interestsOpen, setInterestsOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [profileTab, setProfileTab] = useState<"about" | "events" | "posts" | "circles">("about");

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const [circles, conns, eventData, postData] = await Promise.all([api.listCircles(true), api.listConnections(), api.listEvents(), api.listPosts(user.id)]);
        setEvents(eventData.events || []);
        setPosts(postData.posts || []);
        const mine = (circles.circles || []).filter((c: any) => c.type !== "dm");
        setMyCircles(mine);
        setCircleCount(mine.length);
        setConnections(conns.connected || []);
      } catch {}
    })();
  }, []));

  if (!user) return null;

  const changeBanner = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.75, allowsEditing: true, aspect: [16, 7] });
    if (!res.canceled && res.assets[0]) {
      try {
        const up = await api.uploadImage(res.assets[0].uri);
        await api.updateProfile({ banner_image_url: up.url });
        await refresh();
      } catch {}
    }
  };

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

  const changePhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!res.canceled && res.assets[0]) {
      try {
        const up = await api.uploadImage(res.assets[0].uri);
        await api.updateProfile({ profile_photo_url: up.url });
        await refresh();
      } catch {}
    }
  };

  const verify = async () => {
    setVerifying(true);
    try { await api.verifyStudent(); await refresh(); } finally { setVerifying(false); }
  };

  const preview = (user.interests || []).slice(0, 4);
  const profileEvents = events.filter((e: any) => e.creator_id === user.id || e.my_status === "going" || e.my_status === "interested");

  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]} style={styles.safeTop}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <Pressable style={styles.iconButton}><Icon name="settings-outline" size={22} color={colors.onSurface} /></Pressable>
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Pressable style={styles.banner} onPress={changeBanner} testID="profile-banner">
            {user.banner_image_url ? <Image source={{ uri: user.banner_image_url }} style={styles.bannerImage} /> : <View style={styles.bannerFallback}><Icon name="image-outline" size={26} color={colors.brandPrimary} /><Text style={styles.bannerHint}>Add a banner</Text></View>}
            <View style={styles.bannerEdit}><Icon name="camera" size={14} color="#FFF" /><Text style={styles.bannerEditText}>Edit</Text></View>
          </Pressable>
          <Pressable onPress={changePhoto} style={styles.avatarWrap} testID="profile-photo">
            <Avatar uri={user.profile_photo_url ?? null} name={user.first_name} size={104} />
            <View style={styles.cameraBadge}><Icon name="camera" size={15} color={colors.onBrandPrimary} /></View>
          </Pressable>
          <View style={styles.identity}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{user.first_name} {user.last_name}</Text>
              {user.verified && <Icon name="checkmark-circle" size={20} color={colors.brandPrimary} />}
            </View>
            <Text style={styles.meta}>{user.university || "Student"}</Text>
            <Text style={styles.meta}>{[user.major, user.year].filter(Boolean).join(" · ") || "Complete your profile"}</Text>
            <Text style={styles.profileBio}>{user.bio || "Add a short bio so people know what you're into."}</Text>
          </View>
          <Pressable style={styles.editButton} onPress={() => router.push("/edit-profile")} testID="edit-profile"><Text style={styles.editText}>Edit profile</Text></Pressable>
        </View>

        {!user.verified && (
          <Pressable onPress={verify} testID="verify-student" style={styles.verifyCard}>
            <Icon name="shield-checkmark-outline" size={20} color={colors.brandPrimary} />
            <View style={{ flex: 1 }}><Text style={styles.verifyTitle}>Verify student status</Text><Text style={styles.verifySub}>Unlock verified campus spaces</Text></View>
            <Text style={styles.verifyAction}>{verifying ? "..." : "Verify"}</Text>
          </Pressable>
        )}

        <View style={styles.metrics}>
          <Pressable style={styles.metric} onPress={() => setConnectionsOpen(true)}>
            <Text style={styles.metricNum}>{connections.length}</Text><Text style={styles.metricLabel}>Connections</Text>
          </Pressable>
          <View style={styles.metricDivider} />
          <View style={styles.metric}><Text style={styles.metricNum}>{circleCount}</Text><Text style={styles.metricLabel}>Circles</Text></View>
          <View style={styles.metricDivider} />
          <Pressable style={styles.metric} onPress={() => setInterestsOpen(true)}>
            <Text style={styles.metricNum}>{user.interests?.length || 0}</Text><Text style={styles.metricLabel}>Interests</Text>
          </Pressable>
        </View>

        <View style={styles.profileTabs}>
          {([["about","About"],["events","Events"],["posts","Posts"],["circles","Circles"]] as const).map(([key,label]) => (
            <Pressable key={key} style={styles.profileTab} onPress={() => setProfileTab(key)}>
              <Text style={[styles.profileTabText, profileTab === key && styles.profileTabTextActive]}>{label}</Text>
              {profileTab === key && <View style={styles.profileTabLine} />}
            </Pressable>
          ))}
        </View>

        {profileTab === "about" && <>
        <Pressable style={styles.plainSection} onPress={() => setInterestsOpen(true)}>
          <View style={styles.cardHeader}>
            <View><Text style={styles.cardTitle}>Interests</Text><Text style={styles.cardSub}>{user.interests?.length || 0} selected</Text></View>
            <Icon name="chevron-forward" size={20} color={colors.brandPrimary} />
          </View>
          <View style={styles.previewRow}>{preview.map((i: string) => <View key={i} style={styles.previewTile}><View style={styles.interestEmblem}><Icon name={interestIcon(i) as any} size={20} color={colors.brandPrimary} /></View><Text numberOfLines={1} style={styles.interestName}>{i}</Text></View>)}{(user.interests?.length || 0) > 4 && <View style={styles.previewTile}><View style={styles.interestEmblem}><Text style={styles.moreText}>+{user.interests.length - 4}</Text></View><Text style={styles.interestName}>More</Text></View>}</View>
        </Pressable>

        <View style={styles.plainSection}>
          <View style={styles.cardHeader}><Text style={styles.cardTitle}>Looking for</Text><Icon name="search-outline" size={18} color={colors.brandPrimary} /></View>
          {(user.looking_for || []).length ? <View style={styles.lookingWrap}>{(user.looking_for || []).map((item: string, i: number) => <View key={item} style={[styles.lookingTag, styles[`lookingTag${i % 5}` as keyof typeof styles] as any]}><Text style={styles.lookingText}>{item}</Text></View>)}</View> : <Text style={styles.bio}>Add what you're looking for</Text>}
        </View>


        </>}

        {profileTab === "events" && <View style={styles.eventsSection}>
          {profileEvents.length === 0 ? <View style={styles.tabEmpty}><Icon name="calendar-outline" size={30} color={colors.brandPrimary} /><Text style={styles.tabEmptyTitle}>No events yet</Text><Text style={styles.tabEmptyText}>Events you create, attend, or show interest in will appear here.</Text></View> : profileEvents.map((event: any) => {
            const status = event.creator_id === user.id ? "Created" : event.my_status === "going" ? "Going" : "Interested";
            return <Pressable key={event.id} style={styles.eventCard} onPress={() => router.push(`/event/${event.id}`)}>
              {event.cover_image_url ? <Image source={{ uri: event.cover_image_url }} style={styles.eventCover} /> : <View style={styles.eventCoverFallback}><Icon name="calendar" size={24} color={colors.brandPrimary} /></View>}
              <View style={styles.eventBody}><View style={styles.eventTop}><Text numberOfLines={1} style={styles.eventTitle}>{event.title}</Text><View style={styles.eventStatus}><Text style={styles.eventStatusText}>{status}</Text></View></View>
              <Text style={styles.eventMeta}>{[event.date, event.time].filter(Boolean).join(" · ")}</Text>
              {!!event.location && <Text numberOfLines={1} style={styles.eventMeta}>{event.location}</Text>}</View>
              <Icon name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>;
          })}
        </View>}
        {profileTab === "posts" && <View style={styles.postsSection}>
          <Pressable style={styles.createPostRow} onPress={() => router.push("/create-post")}><Avatar uri={user.profile_photo_url} name={user.first_name} size={38} /><Text style={styles.createPostPrompt}>Start a conversation or make a plan...</Text><View style={styles.createPostPlus}><Icon name="add" size={20} color={colors.onBrandPrimary} /></View></Pressable>
          {posts.length === 0 ? <View style={styles.tabEmpty}><Icon name="chatbubble-ellipses-outline" size={30} color={colors.brandPrimary} /><Text style={styles.tabEmptyTitle}>No posts yet</Text><Text style={styles.tabEmptyText}>Ask a question, find people for a plan, or share what's happening around campus.</Text></View> : posts.map((post:any) => <View key={post.id} style={styles.postCard}>
            <View style={styles.postHead}><Avatar uri={post.author?.profile_photo_url} name={post.author?.first_name || user.first_name} size={38} /><View style={{flex:1}}><Text style={styles.postName}>{post.author?.first_name || user.first_name} {post.author?.last_name || user.last_name}</Text><Text style={styles.postMeta}>{post.intent === "anyone_down" ? "Anyone down?" : post.intent === "looking_for_people" ? "Looking for people" : post.intent === "question" ? "Question" : post.intent === "recommendation" ? "Recommendation" : "Post"} · {post.audience === "connections" ? "Connections" : "Campus"}</Text></View><Pressable onPress={() => Alert.alert("Delete post?", "This cannot be undone.", [{text:"Cancel",style:"cancel"},{text:"Delete",style:"destructive",onPress:async()=>{await api.deletePost(post.id);setPosts((p)=>p.filter((x:any)=>x.id!==post.id));}}])}><Icon name="ellipsis-horizontal" size={20} color={colors.muted} /></Pressable></View>
            <Text style={styles.postText}>{post.content}</Text>
          </View>)}
        </View>}
        {profileTab === "circles" && <View style={styles.eventsSection}>
          {myCircles.filter((circle: any) => circle.type !== "daily").length === 0 ? <View style={styles.tabEmpty}><Icon name="people-circle-outline" size={32} color={colors.brandPrimary} /><Text style={styles.tabEmptyTitle}>No public Circles yet</Text><Text style={styles.tabEmptyText}>Community, hobby, and school Circles can be shown here. Daily Circles and DMs always stay private.</Text></View> : myCircles.filter((circle: any) => circle.type !== "daily").map((circle: any) => {
            const shown = (circle.profile_visible_member_ids || []).includes(user.id);
            return <Pressable key={circle.id} style={styles.circleProfileRow} onPress={() => router.push(`/circle/${circle.id}`)}>
              <View style={styles.circleIcon}><Icon name="people" size={22} color={colors.brandPrimary} /></View>
              <View style={{ flex: 1 }}><Text style={styles.eventTitle}>{circle.name}</Text><Text numberOfLines={1} style={styles.eventMeta}>{(circle.interests || []).slice(0, 3).join(" · ") || `${(circle.member_ids || []).length} members`}</Text></View>
              {shown && <View style={styles.shownBadge}><Icon name="eye" size={13} color={colors.brandPrimary} /><Text style={styles.shownBadgeText}>On profile</Text></View>}
              <Icon name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>;
          })}
          {myCircles.some((circle: any) => circle.type === "daily") && <Text style={styles.privateNote}>Daily Circles stay private and never appear on your public profile.</Text>}
        </View>}

        <View style={styles.signout}><Button label="Sign out" variant="secondary" onPress={async () => { await signOut(); router.replace("/(auth)/welcome"); }} testID="profile-signout" /></View>
      </ScrollView>

      <Modal visible={connectionsOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setConnectionsOpen(false)}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>Connections</Text><Pressable onPress={() => setConnectionsOpen(false)}><Icon name="close" size={26} color={colors.onSurface} /></Pressable></View>
          <ScrollView contentContainerStyle={styles.modalContent}>
            {connections.length === 0 ? <Text style={styles.empty}>Your accepted connections will appear here.</Text> : connections.map((c: any) => (
              <Pressable key={c.id} style={styles.personRow} onPress={() => { setConnectionsOpen(false); router.push(`/match/${c.user.id}`); }}>
                <Avatar uri={c.user.profile_photo_url} name={c.user.first_name} size={48} />
                <View style={{ flex: 1 }}><Text style={styles.personName}>{c.user.first_name} {c.user.last_name}</Text><Text style={styles.personMeta}>{[c.user.major, c.user.year].filter(Boolean).join(" · ")}</Text></View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal visible={interestsOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setInterestsOpen(false)}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}><View><Text style={styles.modalTitle}>Interests</Text><Text style={styles.cardSub}>{user.interests?.length || 0} selected</Text></View><Pressable onPress={() => setInterestsOpen(false)}><Icon name="close" size={26} color={colors.onSurface} /></Pressable></View>
          <ScrollView contentContainerStyle={styles.modalContent}><View style={styles.modalInterestGrid}>{(user.interests || []).map((i: string) => <View key={i} style={styles.modalInterestTile}><View style={styles.interestEmblem}><Icon name={interestIcon(i) as any} size={20} color={colors.brandPrimary} /></View><Text numberOfLines={2} style={styles.modalInterestName}>{i}</Text></View>)}</View></ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface }, safeTop: { backgroundColor: colors.surface },
  header: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl },
  headerTitle: { fontSize: 20, fontWeight: "800", color: colors.onSurface }, iconButton: { padding: 6 },
  content: { paddingBottom: 32 }, hero: { minHeight: 300, paddingHorizontal: spacing.xl, paddingTop: 150, paddingBottom: spacing.xl, backgroundColor: colors.surface, overflow: "hidden" },
  banner: { position: "absolute", top: 0, left: 0, right: 0, height: 185, backgroundColor: colors.surfaceSecondary },
  bannerImage: { width: "100%", height: "100%" }, bannerFallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.brandTertiary, gap: 5 }, bannerHint: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: 12 },
  bannerEdit: { position: "absolute", right: 16, top: 14, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,.55)", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 18 }, bannerEditText: { color: "#FFF", fontWeight: "800", fontSize: 11 },
  avatarWrap: { alignSelf: "flex-start" }, cameraBadge: { position: "absolute", right: -2, bottom: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.surfaceSecondary },
  identity: { marginTop: spacing.md, paddingRight: 115 }, nameRow: { flexDirection: "row", alignItems: "center", gap: 6 }, name: { fontSize: 25, fontWeight: "900", color: colors.onSurface }, meta: { color: colors.muted, fontSize: 13, marginTop: 3 }, profileBio: { color: colors.onSurfaceSecondary, fontSize: 13, lineHeight: 18, marginTop: 9, maxWidth: 250 },
  editButton: { position: "absolute", right: spacing.xl, bottom: spacing.xl, borderWidth: 1.5, borderColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9 }, editText: { color: colors.brandPrimary, fontWeight: "800", fontSize: 13 },
  verifyCard: { margin: spacing.xl, marginBottom: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.brandTertiary },
  verifyTitle: { fontWeight: "800", color: colors.onBrandTertiary }, verifySub: { fontSize: 12, color: colors.onBrandTertiary, opacity: .75, marginTop: 2 }, verifyAction: { fontWeight: "800", color: colors.brandPrimary },
  metrics: { marginHorizontal: spacing.xl, marginTop: spacing.xl, flexDirection: "row", alignItems: "center" }, metric: { flex: 1, alignItems: "center", paddingVertical: 6 }, metricNum: { fontSize: 20, fontWeight: "900", color: colors.onSurface }, metricLabel: { fontSize: 11, color: colors.muted, marginTop: 2 }, metricDivider: { width: 1, height: 30, backgroundColor: colors.border },
  card: { marginHorizontal: spacing.xl, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  profileTabs: { marginTop: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.divider, flexDirection: "row", paddingHorizontal: spacing.xl }, profileTab: { flex: 1, alignItems: "center", paddingVertical: 12, position: "relative" }, profileTabText: { fontSize: 13, fontWeight: "700", color: colors.muted }, profileTabTextActive: { color: colors.brandPrimary, fontWeight: "900" }, profileTabLine: { position: "absolute", bottom: -1, height: 3, width: 34, borderRadius: 2, backgroundColor: colors.brandPrimary }, tabEmpty: { alignItems: "center", paddingHorizontal: 42, paddingVertical: 52 }, tabEmptyTitle: { fontSize: 18, fontWeight: "900", color: colors.onSurface, marginTop: 10 }, tabEmptyText: { fontSize: 13, lineHeight: 19, textAlign: "center", color: colors.muted, marginTop: 6 },
  eventsSection: { paddingHorizontal: spacing.xl, paddingTop: spacing.md }, eventCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider }, eventCover: { width: 66, height: 66, borderRadius: radius.md }, eventCoverFallback: { width: 66, height: 66, borderRadius: radius.md, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }, eventBody: { flex: 1, minWidth: 0 }, eventTop: { flexDirection: "row", alignItems: "center", gap: 7 }, eventTitle: { flex: 1, color: colors.onSurface, fontSize: 15, fontWeight: "800" }, eventMeta: { color: colors.muted, fontSize: 12, marginTop: 4 }, eventStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandTertiary }, eventStatusText: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800" },
  circleProfileRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider }, circleProfileMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 }, circleIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }, shownBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.brandTertiary }, shownBadgeText: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800" }, privateNote: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: spacing.md, textAlign: "center" },
  postsSection: { paddingHorizontal: spacing.xl, paddingTop: spacing.md }, createPostRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider }, createPostPrompt: { flex: 1, color: colors.muted, fontSize: 13 }, createPostPlus: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" }, postCard: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.divider }, postHead: { flexDirection: "row", alignItems: "center", gap: 10 }, postName: { color: colors.onSurface, fontSize: 14, fontWeight: "800" }, postMeta: { color: colors.muted, fontSize: 11, marginTop: 2 }, postText: { color: colors.onSurface, fontSize: 15, lineHeight: 21, marginTop: 11 },
  plainSection: { marginHorizontal: spacing.xl, marginTop: spacing.lg, paddingVertical: spacing.sm },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }, cardTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface }, cardSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  bio: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 21, marginTop: spacing.sm }, detailRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }, detailPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill }, detailText: { fontSize: 12, color: colors.onSurfaceSecondary, fontWeight: "600" },
  lookingWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.md }, lookingTag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill }, lookingTag0: { backgroundColor: "#EAF3FF" }, lookingTag1: { backgroundColor: "#F1EBFF" }, lookingTag2: { backgroundColor: "#FFF1DF" }, lookingTag3: { backgroundColor: "#E9F8F0" }, lookingTag4: { backgroundColor: "#FFECEF" }, lookingText: { color: colors.onSurface, fontSize: 12, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  previewRow: { flexDirection: "row", justifyContent: "space-between", gap: 3, marginTop: spacing.sm }, previewTile: { flex: 1, minWidth: 0, maxWidth: "20%", alignItems: "center", gap: 5, paddingVertical: 4 }, modalInterestGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, alignItems: "flex-start" }, modalInterestTile: { width: "29%", alignItems: "center", gap: 7, paddingVertical: 8 }, modalInterestName: { color: colors.onSurface, fontSize: 12, fontWeight: "700", textAlign: "center", width: "100%" }, interestEmblem: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }, interestName: { color: colors.onSurface, fontSize: 11, fontWeight: "700", maxWidth: 88, textAlign: "center" }, more: { minWidth: 42, height: 34, paddingHorizontal: 10, borderRadius: 17, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" }, moreText: { color: colors.onSurface, fontWeight: "800", fontSize: 12 },
  signout: { paddingHorizontal: spacing.xl, marginTop: spacing.xl }, modalRoot: { flex: 1, backgroundColor: colors.surface }, modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.divider }, modalTitle: { fontSize: 22, fontWeight: "900", color: colors.onSurface }, modalContent: { padding: spacing.xl, paddingBottom: 50 },
  empty: { color: colors.muted, textAlign: "center", marginTop: spacing.xxxl }, personRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider }, personName: { color: colors.onSurface, fontSize: 15, fontWeight: "800" }, personMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
});
