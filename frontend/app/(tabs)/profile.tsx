import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import * as ImagePicker from "expo-image-picker";
import { colors, spacing, radius } from "@/src/theme";
import { Avatar, Button, Chip } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { MainTabBar } from "@/src/components/main-tab-bar";

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

  const changePhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.7 });
    if (!res.canceled && res.assets[0]) {
      try {
        const up = await api.uploadImage(res.assets[0].uri);
        await api.saveOnboarding({ profile_photo_url: up.url });
        await refresh();
      } catch {}
    }
  };

  const verify = async () => {
    setVerifying(true);
    try { await api.verifyStudent(); await refresh(); } finally { setVerifying(false); }
  };

  const preview = (user.interests || []).slice(0, 5);

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
          <View style={styles.heroGlow} />
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
          <Pressable style={styles.editButton}><Text style={styles.editText}>Edit profile</Text></Pressable>
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
          <View style={styles.chips}>{preview.map((i: string) => <Chip key={i} label={i} selected />)}{(user.interests?.length || 0) > 5 && <View style={styles.more}><Text style={styles.moreText}>+{user.interests.length - 5}</Text></View>}</View>
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
          <ScrollView contentContainerStyle={styles.modalContent}><View style={styles.chips}>{(user.interests || []).map((i: string) => <Chip key={i} label={i} selected />)}</View></ScrollView>
        </SafeAreaView>
      </Modal>

      <MainTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface }, safeTop: { backgroundColor: colors.surface },
  header: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.xl },
  headerTitle: { fontSize: 20, fontWeight: "800", color: colors.onSurface }, iconButton: { padding: 6 },
  content: { paddingBottom: 32 }, hero: { minHeight: 180, paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.xl, backgroundColor: colors.surfaceSecondary, overflow: "hidden" },
  heroGlow: { position: "absolute", width: 180, height: 180, borderRadius: 90, backgroundColor: colors.brandTertiary, right: -45, top: -80, opacity: .9 },
  avatarWrap: { alignSelf: "flex-start" }, cameraBadge: { position: "absolute", right: -2, bottom: 2, width: 30, height: 30, borderRadius: 15, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.surfaceSecondary },
  identity: { marginTop: spacing.md, paddingRight: 115 }, nameRow: { flexDirection: "row", alignItems: "center", gap: 6 }, name: { fontSize: 25, fontWeight: "900", color: colors.onSurface }, meta: { color: colors.muted, fontSize: 13, marginTop: 3 },
  editButton: { position: "absolute", right: spacing.xl, bottom: spacing.xl, borderWidth: 1.5, borderColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: 16, paddingVertical: 9 }, editText: { color: colors.brandPrimary, fontWeight: "800", fontSize: 13 },
  verifyCard: { margin: spacing.xl, marginBottom: 0, flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.brandTertiary },
  verifyTitle: { fontWeight: "800", color: colors.onBrandTertiary }, verifySub: { fontSize: 12, color: colors.onBrandTertiary, opacity: .75, marginTop: 2 }, verifyAction: { fontWeight: "800", color: colors.brandPrimary },
  metrics: { marginHorizontal: spacing.xl, marginTop: spacing.xl, flexDirection: "row", alignItems: "center" }, metric: { flex: 1, alignItems: "center", paddingVertical: 6 }, metricNum: { fontSize: 20, fontWeight: "900", color: colors.onSurface }, metricLabel: { fontSize: 11, color: colors.muted, marginTop: 2 }, metricDivider: { width: 1, height: 30, backgroundColor: colors.border },
  card: { marginHorizontal: spacing.xl, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }, cardTitle: { fontSize: 17, fontWeight: "800", color: colors.onSurface }, cardSub: { fontSize: 12, color: colors.muted, marginTop: 2 },
  bio: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 21, marginTop: spacing.sm }, detailRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }, detailPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill }, detailText: { fontSize: 12, color: colors.onSurfaceSecondary, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }, more: { minWidth: 42, height: 34, paddingHorizontal: 10, borderRadius: 17, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" }, moreText: { color: colors.onSurface, fontWeight: "800", fontSize: 12 },
  signout: { paddingHorizontal: spacing.xl, marginTop: spacing.xl }, modalRoot: { flex: 1, backgroundColor: colors.surface }, modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.divider }, modalTitle: { fontSize: 22, fontWeight: "900", color: colors.onSurface }, modalContent: { padding: spacing.xl, paddingBottom: 50 },
  empty: { color: colors.muted, textAlign: "center", marginTop: spacing.xxxl }, personRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider }, personName: { color: colors.onSurface, fontSize: 15, fontWeight: "800" }, personMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
});
