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
  const [connections, setConnections] = useState<any[]>([]);
  const [interestsOpen, setInterestsOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const [circles, conns] = await Promise.all([api.listCircles(true), api.listConnections()]);
        setCircleCount((circles.circles || []).filter((c: any) => c.type !== "dm").length);
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

        <View style={styles.card}>
          <View style={styles.cardHeader}><Text style={styles.cardTitle}>About me</Text><Icon name="create-outline" size={18} color={colors.muted} /></View>
          <Text style={styles.bio}>{user.bio || "Add a short bio so people know what you're into and what kind of people you'd like to meet."}</Text>
          <View style={styles.detailRow}>
            {user.year ? <View style={styles.detailPill}><Icon name="school-outline" size={14} color={colors.brandPrimary} /><Text style={styles.detailText}>{user.year}</Text></View> : null}
            {user.major ? <View style={styles.detailPill}><Icon name="book-outline" size={14} color={colors.brandPrimary} /><Text style={styles.detailText}>{user.major}</Text></View> : null}
          </View>
        </View>

        <Pressable style={styles.card} onPress={() => setInterestsOpen(true)}>
          <View style={styles.cardHeader}>
            <View><Text style={styles.cardTitle}>Interests</Text><Text style={styles.cardSub}>{user.interests?.length || 0} selected</Text></View>
            <Icon name="chevron-forward" size={20} color={colors.brandPrimary} />
          </View>
          <View style={styles.interestGrid}>{preview.map((i: string) => <View key={i} style={styles.interestTile}><View style={styles.interestEmblem}><Icon name={interestIcon(i) as any} size={20} color={colors.brandPrimary} /></View><Text numberOfLines={1} style={styles.interestName}>{i}</Text></View>)}{(user.interests?.length || 0) > 4 && <View style={styles.interestTile}><View style={styles.interestEmblem}><Text style={styles.moreText}>+{user.interests.length - 4}</Text></View><Text style={styles.interestName}>More</Text></View>}</View>
        </Pressable>

        <View style={styles.card}>
          <View style={styles.cardHeader}><Text style={styles.cardTitle}>Looking for</Text><Icon name="search-outline" size={18} color={colors.brandPrimary} /></View>
          <Text style={styles.bio}>{(user.looking_for || []).join(" · ") || "Add what you're looking for"}</Text>
        </View>

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
          <ScrollView contentContainerStyle={styles.modalContent}><View style={styles.interestGrid}>{(user.interests || []).map((i: string) => <View key={i} style={styles.interestTile}><View style={styles.interestEmblem}><Icon name={interestIcon(i) as any} size={20} color={colors.brandPrimary} /></View><Text numberOfLines={1} style={styles.interestName}>{i}</Text></View>)}</View></ScrollView>
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
  identity: { marginTop: spacing.md, paddingRight: 115 }, nameRow: { flexDirection: "row", alignItems: "center", gap: 6 }, name: { fontSize: 25, fontWeight: "900", color: colors.onSurface }, meta: { color: colors.muted, fontSize: 13, marginTop: 3 },
  editButton: { position: "absolute", right: spacing.xl, bottom: spacing.xl, borderWidth: 1.5, borderColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9 }, editText: { color: colors.brandPrimary, fontWeight: "800", fontSize: 13 },
  verifyCard: { margin: spacing.xl, marginBottom: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.brandTertiary },
  verifyTitle: { fontWeight: "800", color: colors.onBrandTertiary }, verifySub: { fontSize: 12, color: colors.onBrandTertiary, opacity: .75, marginTop: 2 }, verifyAction: { fontWeight: "800", color: colors.brandPrimary },
  metrics: { marginHorizontal: spacing.xl, marginTop: spacing.xl, flexDirection: "row", alignItems: "center" }, metric: { flex: 1, alignItems: "center", paddingVertical: 6 }, metricNum: { fontSize: 20, fontWeight: "900", color: colors.onSurface }, metricLabel: { fontSize: 11, color: colors.muted, marginTop: 2 }, metricDivider: { width: 1, height: 30, backgroundColor: colors.border },
  card: { marginHorizontal: spacing.xl, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }, cardTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface }, cardSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  bio: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 21, marginTop: spacing.sm }, detailRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }, detailPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill }, detailText: { fontSize: 12, color: colors.onSurfaceSecondary, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  interestGrid: { flexDirection: "row", flexWrap: "nowrap", justifyContent: "space-between", gap: 4, marginTop: spacing.sm }, interestTile: { flex: 1, minWidth: 0, alignItems: "center", gap: 5, paddingVertical: 5 }, interestEmblem: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" }, interestName: { color: colors.onSurface, fontSize: 11, fontWeight: "700", maxWidth: 88, textAlign: "center" }, more: { minWidth: 42, height: 34, paddingHorizontal: 10, borderRadius: 17, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" }, moreText: { color: colors.onSurface, fontWeight: "800", fontSize: 12 },
  signout: { paddingHorizontal: spacing.xl, marginTop: spacing.xl }, modalRoot: { flex: 1, backgroundColor: colors.surface }, modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.divider }, modalTitle: { fontSize: 22, fontWeight: "900", color: colors.onSurface }, modalContent: { padding: spacing.xl, paddingBottom: 50 },
  empty: { color: colors.muted, textAlign: "center", marginTop: spacing.xxxl }, personRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider }, personName: { color: colors.onSurface, fontSize: 15, fontWeight: "800" }, personMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
});
