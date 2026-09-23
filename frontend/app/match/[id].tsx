import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius } from "@/src/theme";
import { Avatar, Button, Chip } from "@/src/ui";
import { api } from "@/src/api";
import { MainTabBar } from "@/src/components/main-tab-bar";

export default function MatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [connecting, setConnecting] = useState(false);
  const [interestsOpen, setInterestsOpen] = useState(false);
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [connections, setConnections] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [profile, conns] = await Promise.all([api.getUser(id!), api.getUserConnections(id!)]);
      setData(profile); setConnections(conns.connections || []);
    } catch {}
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!data) return <SafeAreaView style={styles.root}><Text style={styles.loading}>Loading profile...</Text></SafeAreaView>;
  const u = data.user;
  const conn = data.connection ?? { status: "none" };
  const sharedNorm = new Set((data.shared_interests || []).map((x: string) => x.trim().toLowerCase()));
  const sortedInterests = [...(u.interests || [])].sort((a: string, b: string) => Number(sharedNorm.has(b.trim().toLowerCase())) - Number(sharedNorm.has(a.trim().toLowerCase())));
  const preview = sortedInterests.slice(0, 5);

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
        <View style={styles.header}><Pressable onPress={() => router.back()} testID="match-back" style={styles.headerBtn}><Icon name="chevron-back" size={25} color={colors.onSurface} /></Pressable><Text style={styles.headerTitle}>Profile</Text><View style={{ width: 37 }} /></View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <Avatar uri={u.profile_photo_url} name={u.first_name} size={108} />
          <View style={styles.identity}>
            <View style={styles.nameRow}><Text style={styles.name}>{u.first_name} {u.last_name}</Text>{u.verified && <Icon name="checkmark-circle" size={20} color={colors.brandPrimary} />}</View>
            <Text style={styles.meta}>{u.university || "Student"}</Text>
            <Text style={styles.meta}>{[u.major, u.year].filter(Boolean).join(" · ")}</Text>
          </View>
          <View style={styles.matchRing}><Text style={styles.matchScore}>{data.compatibility}%</Text><Text style={styles.matchLabel}>Match</Text></View>
        </View>

        <View style={styles.actions}>
          <Button label={connectLabel} onPress={onConnect} loading={connecting} disabled={conn.status === "pending_out"} style={{ flex: 1 }} testID="match-connect" />
          {conn.status !== "connected" && <Button label="Maybe later" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} testID="match-later" />}
        </View>

        <Pressable style={styles.connectionRow} onPress={() => setConnectionsOpen(true)}>
          <View style={styles.connectionLeft}><Icon name="people-outline" size={20} color={colors.brandPrimary} /><Text style={styles.connectionCount}>{data.connection_count || 0}</Text><Text style={styles.connectionText}>Connections</Text></View>
          <Icon name="chevron-forward" size={19} color={colors.brandPrimary} />
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>About me</Text>
          <Text style={styles.bio}>{u.bio || `${u.first_name} hasn't added a bio yet.`}</Text>
          <View style={styles.detailRow}>
            {u.year ? <View style={styles.detailPill}><Icon name="school-outline" size={14} color={colors.brandPrimary} /><Text style={styles.detailText}>{u.year}</Text></View> : null}
            {u.major ? <View style={styles.detailPill}><Icon name="book-outline" size={14} color={colors.brandPrimary} /><Text style={styles.detailText}>{u.major}</Text></View> : null}
          </View>
        </View>

        <Pressable style={styles.card} onPress={() => setInterestsOpen(true)}>
          <View style={styles.cardHeader}>
            <View><Text style={styles.cardTitle}>Interests</Text><Text style={styles.cardSub}>{data.shared_interests?.length || 0} in common · {u.interests?.length || 0} total</Text></View>
            <Icon name="chevron-forward" size={20} color={colors.brandPrimary} />
          </View>
          <View style={styles.chips}>{preview.map((i: string) => <Chip key={i} label={i} selected={sharedNorm.has(i.trim().toLowerCase())} />)}{sortedInterests.length > 5 && <View style={styles.more}><Text style={styles.moreText}>+{sortedInterests.length - 5}</Text></View>}</View>
        </Pressable>

        <View style={styles.youTwo}>
          <View style={styles.cardHeader}><View style={styles.youTitle}><Icon name="sparkles" size={18} color={colors.brandPrimary} /><Text style={styles.cardTitle}>You two</Text></View><Text style={styles.youScore}>{data.compatibility}% match</Text></View>
          {(data.reasons || []).slice(0, 4).map((r: string, i: number) => <View key={i} style={styles.reason}><Icon name={i === 0 ? "heart-outline" : "checkmark-circle-outline"} size={17} color={colors.brandPrimary} /><Text style={styles.reasonText}>{r}</Text></View>)}
          {!(data.reasons || []).length && <Text style={styles.bio}>As you use Circle, we'll show more about why you match here.</Text>}
        </View>

        {(u.looking_for || []).length > 0 && <View style={styles.compactCard}><Icon name="search-outline" size={18} color={colors.brandPrimary} /><Text style={styles.compactTitle}>Looking for</Text><Text numberOfLines={1} style={styles.compactValue}>{u.looking_for.join(", ")}</Text></View>}

        {conn.status === "pending_in" && <View style={styles.pending}><Icon name="mail-unread-outline" size={17} color={colors.brandPrimary} /><Text style={styles.pendingText}>{u.first_name} wants to connect with you</Text></View>}
      </ScrollView>

      <Modal visible={connectionsOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setConnectionsOpen(false)}>
        <SafeAreaView style={styles.modalRoot}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{u.first_name}'s connections</Text><Pressable onPress={() => setConnectionsOpen(false)}><Icon name="close" size={26} color={colors.onSurface} /></Pressable></View><ScrollView contentContainerStyle={styles.modalContent}>{connections.length === 0 ? <Text style={styles.empty}>No connections yet.</Text> : connections.map((c: any) => <Pressable key={c.id} style={styles.personRow} onPress={() => { setConnectionsOpen(false); router.push(`/match/${c.user.id}`); }}><Avatar uri={c.user.profile_photo_url} name={c.user.first_name} size={48} /><View style={{ flex: 1 }}><Text style={styles.personName}>{c.user.first_name} {c.user.last_name}</Text><Text style={styles.personMeta}>{[c.user.major, c.user.year].filter(Boolean).join(" · ")}</Text></View><Icon name="chevron-forward" size={18} color={colors.muted} /></Pressable>)}</ScrollView></SafeAreaView>
      </Modal>

      <Modal visible={interestsOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setInterestsOpen(false)}>
        <SafeAreaView style={styles.modalRoot}><View style={styles.modalHeader}><View><Text style={styles.modalTitle}>Interests</Text><Text style={styles.cardSub}>Shared interests are highlighted</Text></View><Pressable onPress={() => setInterestsOpen(false)}><Icon name="close" size={26} color={colors.onSurface} /></Pressable></View><ScrollView contentContainerStyle={styles.modalContent}><View style={styles.chips}>{sortedInterests.map((i: string) => <Chip key={i} label={i} selected={sharedNorm.has(i.trim().toLowerCase())} />)}</View></ScrollView></SafeAreaView>
      </Modal>

      <MainTabBar />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface }, safeTop: { backgroundColor: colors.surface }, loading: { padding: 24, color: colors.muted },
  header: { height: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg }, headerBtn: { padding: 6 }, headerTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  content: { paddingBottom: 36 }, hero: { minHeight: 170, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl, backgroundColor: colors.surfaceSecondary, overflow: "hidden", flexDirection: "row", alignItems: "flex-end", gap: spacing.md },
  heroGlow: { position: "absolute", width: 210, height: 210, borderRadius: 105, backgroundColor: colors.brandTertiary, right: -55, top: -100 }, identity: { flex: 1, paddingBottom: 5 }, nameRow: { flexDirection: "row", alignItems: "center", gap: 5, flexWrap: "wrap" }, name: { fontSize: 23, fontWeight: "900", color: colors.onSurface }, meta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  matchRing: { width: 76, height: 76, borderRadius: 38, borderWidth: 5, borderColor: colors.brandPrimary, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", marginBottom: 4 }, matchScore: { color: colors.onSurface, fontWeight: "900", fontSize: 18 }, matchLabel: { color: colors.muted, fontWeight: "700", fontSize: 10 },
  actions: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.xl, paddingTop: spacing.xl }, connectionRow: { marginHorizontal: spacing.xl, marginTop: spacing.lg, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider }, connectionLeft: { flexDirection: "row", alignItems: "center", gap: 7 }, connectionCount: { fontWeight: "900", color: colors.onSurface, fontSize: 15 }, connectionText: { color: colors.muted, fontSize: 14 },
  card: { marginHorizontal: spacing.xl, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }, cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }, cardTitle: { color: colors.onSurface, fontWeight: "800", fontSize: 17 }, cardSub: { color: colors.muted, fontSize: 12, marginTop: 2 }, bio: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 21, marginTop: spacing.sm },
  detailRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }, detailPill: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.surface, paddingHorizontal: 10, paddingVertical: 7, borderRadius: radius.pill }, detailText: { fontSize: 12, color: colors.onSurfaceSecondary, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md }, more: { minWidth: 42, height: 34, paddingHorizontal: 10, borderRadius: 17, borderWidth: 1, borderColor: colors.borderStrong, alignItems: "center", justifyContent: "center" }, moreText: { color: colors.onSurface, fontWeight: "800", fontSize: 12 },
  youTwo: { marginHorizontal: spacing.xl, marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.brandTertiary }, youTitle: { flexDirection: "row", alignItems: "center", gap: 7 }, youScore: { color: colors.brandPrimary, fontSize: 14, fontWeight: "900" }, reason: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.md }, reasonText: { color: colors.onBrandTertiary, fontSize: 13, flex: 1 },
  compactCard: { marginHorizontal: spacing.xl, marginTop: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary }, compactTitle: { color: colors.onSurface, fontWeight: "800" }, compactValue: { color: colors.muted, fontSize: 12, flex: 1, textAlign: "right" }, pending: { marginHorizontal: spacing.xl, marginTop: spacing.lg, flexDirection: "row", gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandTertiary }, pendingText: { color: colors.onBrandTertiary, fontWeight: "700", flex: 1 },
  modalRoot: { flex: 1, backgroundColor: colors.surface }, modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.divider }, modalTitle: { fontSize: 22, fontWeight: "900", color: colors.onSurface }, modalContent: { padding: spacing.xl, paddingBottom: 50 }, empty: { color: colors.muted, textAlign: "center", marginTop: spacing.xxxl }, personRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider }, personName: { color: colors.onSurface, fontSize: 15, fontWeight: "800" }, personMeta: { color: colors.muted, fontSize: 12, marginTop: 3 },
});
