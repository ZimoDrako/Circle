import { useCallback, useState } from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius } from "@/src/theme";
import { Avatar, EmptyState, Chip, CompatibilityBadge } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

type Seg = "mine" | "messages" | "all";

export default function Circles() {
  const router = useRouter();
  const { user } = useAuth();
  const [seg, setSeg] = useState<Seg>("mine");
  const [circles, setCircles] = useState<any[]>([]);
  const [dms, setDms] = useState<any[]>([]);
  const [conns, setConns] = useState<{ incoming: any[]; outgoing: any[]; connected: any[] }>({ incoming: [], outgoing: [], connected: [] });
  const [lounge, setLounge] = useState<{ locked: boolean; circle: any; member_count?: number } | null>(null);

  const load = useCallback(async () => {
    try {
      if (seg === "messages") {
        const [d, c] = await Promise.all([api.listDMs(), api.listConnections()]);
        setDms(d.circles || []);
        setConns(c);
      } else {
        const [r, l] = await Promise.all([api.listCircles(seg === "mine"), api.getLounge()]);
        setCircles((r.circles || []).filter((c: any) => !c.is_lounge));
        setLounge(l);
      }
    } catch {}
  }, [seg]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const accept = async (id: string) => {
    try {
      const r = await api.acceptConnection(id);
      if (r.connection?.circle_id) router.push(`/circle/${r.connection.circle_id}`);
    } catch {}
    load();
  };
  const decline = async (id: string) => {
    try { await api.declineConnection(id); } catch {}
    load();
  };

  const pendingCount = conns.incoming.length;

  const LoungeCard = () => {
    if (!lounge) return null;
    if (lounge.locked) {
      return (
        <Pressable testID="lounge-locked" onPress={() => router.push("/(tabs)/profile")} style={[styles.card, styles.loungeLocked]}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={styles.lockIcon}><Icon name="lock-closed" size={20} color={colors.onBrandTertiary} /></View>
            <View style={{ flex: 1, marginLeft: spacing.md }}>
              <Text style={styles.name}>Verified Lounge</Text>
              <Text style={styles.meta}>Private · {lounge.member_count ?? 0} verified Titans inside</Text>
            </View>
            <Icon name="chevron-forward" size={20} color={colors.muted} />
          </View>
          <Text style={styles.loungeHint}>Tap CSUF Verified on your profile to unlock this lounge.</Text>
        </Pressable>
      );
    }
    const c = lounge.circle;
    return (
      <Pressable testID="lounge-card" onPress={() => router.push(`/circle/${c.id}`)} style={[styles.card, styles.loungeOpen]}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={[styles.lockIcon, { backgroundColor: colors.brandPrimary }]}><Icon name="shield-checkmark" size={20} color={colors.onBrandPrimary} /></View>
          <View style={{ flex: 1, marginLeft: spacing.md }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.name}>{c.name}</Text>
              <View style={styles.verifiedPill}><Text style={styles.verifiedPillText}>VERIFIED ONLY</Text></View>
            </View>
            <Text style={styles.meta}>{c.member_ids.length} verified Titans · private lounge</Text>
          </View>
          <Icon name="chevron-forward" size={20} color={colors.muted} />
        </View>
      </Pressable>
    );
  };

  const renderCircle = ({ item: c }: { item: any }) => (
    <Pressable testID={`circle-card-${c.id}`} onPress={() => router.push(`/circle/${c.id}`)} style={styles.card}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={styles.avatarStack}>
          {c.members.slice(0, 4).map((m: any, i: number) => (
            <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -14, borderWidth: 2, borderColor: colors.surface, borderRadius: 999 }}>
              <Avatar uri={m.profile_photo_url} name={m.first_name} size={40} />
            </View>
          ))}
        </View>
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.name}>{c.name}</Text>
            {c.verified_only && <Icon name="shield-checkmark" size={14} color={colors.brandPrimary} />}
          </View>
          <Text style={styles.meta}>{c.member_ids.length} members</Text>
        </View>
        <Icon name="chevron-forward" size={20} color={colors.muted} />
      </View>
      <View style={styles.chips}>
        {c.interests.slice(0, 4).map((i: string) => (
          <View key={i} style={styles.chip}>
            <Text style={styles.chipText}>{i}</Text>
          </View>
        ))}
      </View>
      {c.shared_with_you?.length > 0 && (
        <View style={styles.whyRow}>
          <Icon name="sparkles" size={12} color={colors.brandPrimary} />
          <Text style={styles.whyText}>You share {c.shared_with_you.slice(0, 3).join(", ")}</Text>
        </View>
      )}
    </Pressable>
  );

  const renderDM = ({ item: c }: { item: any }) => {
    const o = c.other_user;
    return (
      <Pressable testID={`dm-card-${c.id}`} onPress={() => router.push(`/circle/${c.id}`)} style={styles.dmRow}>
        <Avatar uri={o?.profile_photo_url} name={o?.first_name} size={48} />
        <View style={{ flex: 1, marginLeft: spacing.md }}>
          <Text style={styles.name}>{c.name}</Text>
          <Text numberOfLines={1} style={styles.meta}>
            {c.last_message ? `${c.last_message.sender_id === user?.id ? "You: " : ""}${c.last_message.content}` : "You're connected — say hi 👋"}
          </Text>
        </View>
        <Icon name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>
    );
  };

  const MessagesHeader = () => (
    <View>
      {conns.incoming.length > 0 && (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={styles.groupLabel}>CONNECTION REQUESTS</Text>
          {conns.incoming.map((r) => (
            <View key={r.id} style={styles.reqRow} testID={`request-${r.id}`}>
              <Pressable onPress={() => router.push(`/match/${r.user.id}`)}>
                <Avatar uri={r.user.profile_photo_url} name={r.user.first_name} size={48} />
              </Pressable>
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={styles.name}>{r.user.first_name}</Text>
                  <CompatibilityBadge score={r.compatibility} />
                </View>
                <Text numberOfLines={1} style={styles.meta}>{r.reasons?.[0] || r.user.major}</Text>
              </View>
              <Pressable onPress={() => decline(r.id)} style={styles.declineBtn} testID={`request-decline-${r.id}`}>
                <Icon name="close" size={18} color={colors.onSurfaceSecondary} />
              </Pressable>
              <Pressable onPress={() => accept(r.id)} style={styles.acceptBtn} testID={`request-accept-${r.id}`}>
                <Icon name="checkmark" size={18} color={colors.onBrandPrimary} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {conns.outgoing.length > 0 && (
        <View style={{ marginBottom: spacing.md }}>
          <Text style={styles.groupLabel}>SENT</Text>
          {conns.outgoing.map((r) => (
            <Pressable key={r.id} onPress={() => router.push(`/match/${r.user.id}`)} style={styles.reqRow}>
              <Avatar uri={r.user.profile_photo_url} name={r.user.first_name} size={40} />
              <View style={{ flex: 1, marginLeft: spacing.md }}>
                <Text style={styles.name}>{r.user.first_name}</Text>
                <Text style={styles.meta}>Waiting for them to connect back</Text>
              </View>
              <Icon name="time-outline" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      )}
      {dms.length > 0 && <Text style={styles.groupLabel}>CHATS</Text>}
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Circles</Text>
        <Text style={styles.sub}>Small groups. Real plans.</Text>
        <View style={styles.tabsRow}>
          <Chip label="Your Circles" selected={seg === "mine"} onPress={() => setSeg("mine")} testID="circles-tab-mine" />
          <Chip label={pendingCount ? `Messages · ${pendingCount}` : "Messages"} selected={seg === "messages"} onPress={() => setSeg("messages")} testID="circles-tab-messages" />
          <Chip label="Discover" selected={seg === "all"} onPress={() => setSeg("all")} testID="circles-tab-all" />
        </View>
      </View>

      {seg === "messages" ? (
        <FlatList
          data={dms}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing.xl, paddingTop: 0, gap: spacing.sm, paddingBottom: 40 }}
          ListHeaderComponent={<MessagesHeader />}
          ListEmptyComponent={
            conns.incoming.length === 0 && conns.outgoing.length === 0 ? (
              <EmptyState title="No messages yet" subtitle="Tap Connect on someone you vibe with. When they connect back, a 1:1 chat opens here." />
            ) : null
          }
          renderItem={renderDM}
        />
      ) : (
        <FlatList
          data={circles}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing.xl, paddingTop: 0, gap: spacing.md, paddingBottom: 40 }}
          ListHeaderComponent={<LoungeCard />}
          ListEmptyComponent={
            <EmptyState
              title={seg === "mine" ? "No Circles yet" : "Nothing to discover"}
              subtitle={seg === "mine" ? "Create a Circle from an event or the Create tab." : ""}
            />
          }
          renderItem={renderCircle}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface },
  sub: { color: colors.muted, fontSize: 14, marginTop: 2 },
  tabsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.sm },
  card: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  loungeLocked: { borderStyle: "dashed", borderColor: colors.brandPrimary, backgroundColor: colors.surface },
  loungeOpen: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  lockIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  loungeHint: { color: colors.brandPrimary, fontSize: 12, fontWeight: "600", marginTop: spacing.sm },
  verifiedPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  verifiedPillText: { color: colors.onBrandPrimary, fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  avatarStack: { flexDirection: "row" },
  name: { color: colors.onSurface, fontWeight: "700", fontSize: 16 },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: spacing.md },
  chip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.brandTertiary },
  chipText: { color: colors.onBrandTertiary, fontWeight: "600", fontSize: 11 },
  whyRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm, gap: 6 },
  whyText: { color: colors.brandPrimary, fontSize: 12, fontWeight: "600" },
  groupLabel: { color: colors.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginBottom: spacing.sm, marginTop: spacing.xs },
  reqRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, marginBottom: spacing.sm, gap: spacing.xs },
  declineBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  acceptBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  dmRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary },
});
