import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius } from "@/src/theme";
import { Avatar, Button, Chip, CompatibilityBadge } from "@/src/ui";
import { api } from "@/src/api";

export default function MatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const r = await api.getUser(id!);
      setData(r);
    } catch {}
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const [connecting, setConnecting] = useState(false);
  const conn = data?.connection ?? { status: "none" };

  const onConnect = async () => {
    setConnecting(true);
    try {
      if (conn.status === "connected" && conn.circle_id) {
        router.push(`/circle/${conn.circle_id}`);
        return;
      }
      const r =
        conn.status === "pending_in"
          ? await api.acceptConnection(conn.id)
          : await api.requestConnection(id!);
      setData((d: any) => ({ ...d, connection: r.connection }));
      if (r.connection.status === "connected" && r.connection.circle_id) {
        router.push(`/circle/${r.connection.circle_id}`);
      }
    } catch {}
    setConnecting(false);
  };

  const connectLabel =
    conn.status === "connected" ? "Message" : conn.status === "pending_in" ? "Accept & chat" : conn.status === "pending_out" ? "Requested" : "Connect";

  if (!data) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}><Text style={{ padding: 24, color: colors.muted }}>Loading...</Text></SafeAreaView>;
  const u = data.user;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="match-back"><Icon name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={{ width: 26 }} />
        </View>
      </SafeAreaView>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.top}>
          <Avatar uri={u.profile_photo_url} name={u.first_name} size={120} />
          <Text style={styles.name}>{u.first_name} {u.last_name}</Text>
          <Text style={styles.meta}>{u.major} · {u.year}</Text>
          <View style={{ marginTop: spacing.md }}>
            <CompatibilityBadge score={data.compatibility} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.whyHeader}>
            <Icon name="sparkles" size={16} color={colors.brandPrimary} />
            <Text style={styles.whyTitle}>Why you match</Text>
          </View>
          {data.reasons.map((r: string, i: number) => (
            <View key={i} style={styles.reasonRow}>
              <View style={styles.reasonDot} />
              <Text style={styles.reasonText}>{r}</Text>
            </View>
          ))}
        </View>

        {u.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bio}>{u.bio}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <View style={styles.chips}>
            {u.interests.map((i: string) => (
              <Chip key={i} label={i} selected={data.shared_interests?.includes(i)} />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Looking for</Text>
          <View style={styles.chips}>
            {u.looking_for.map((i: string) => <Chip key={i} label={i} />)}
          </View>
        </View>

        {conn.status === "pending_in" && (
          <View style={styles.pendingNote}>
            <Icon name="mail-unread-outline" size={16} color={colors.brandPrimary} />
            <Text style={styles.pendingText}>{u.first_name} wants to connect with you</Text>
          </View>
        )}
        {conn.status === "pending_out" && (
          <View style={styles.pendingNote}>
            <Icon name="time-outline" size={16} color={colors.muted} />
            <Text style={[styles.pendingText, { color: colors.muted }]}>{`Request sent — you'll chat once ${u.first_name} connects back`}</Text>
          </View>
        )}

        <View style={{ padding: spacing.xl, flexDirection: "row", gap: spacing.md }}>
          <Button label="Maybe later" variant="secondary" onPress={() => router.back()} style={{ flex: 1 }} testID="match-later" />
          <Button
            label={connectLabel}
            onPress={onConnect}
            loading={connecting}
            disabled={conn.status === "pending_out"}
            style={{ flex: 1 }}
            testID="match-connect"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  top: { alignItems: "center", paddingHorizontal: spacing.xl, paddingBottom: spacing.lg },
  name: { fontSize: 24, fontWeight: "800", color: colors.onSurface, marginTop: spacing.md },
  meta: { color: colors.muted, fontSize: 14, marginTop: 4 },
  section: { paddingHorizontal: spacing.xl, marginTop: spacing.md },
  whyHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  whyTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: 6 },
  reasonDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brandPrimary },
  reasonText: { color: colors.onSurfaceSecondary, fontSize: 14 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.sm },
  bio: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pendingNote: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginHorizontal: spacing.xl, marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  pendingText: { color: colors.brandPrimary, fontSize: 13, fontWeight: "600", flex: 1 },
});
