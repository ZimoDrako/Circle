import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { spacing, radius, useTheme, makeStyles } from "@/src/theme";
import { Button, Chip, EmptyState } from "@/src/ui";
import { api } from "@/src/api";
import { MainTabBar } from "@/src/components/main-tab-bar";

export default function ClubDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [club, setClub] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try { const r = await api.getClub(id); setClub(r.club); }
    catch { setClub(null); }
    finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const join = async () => {
    if (!id || busy) return;
    setBusy(true);
    try { await api.joinClub(id); await load(); }
    catch (e: any) { Alert.alert("Could not join", e?.message || "Try again."); }
    finally { setBusy(false); }
  };

  const openChat = async () => {
    if (!id || busy) return;
    setBusy(true);
    try {
      const r = await api.getClubChat(id);
      router.push(`/circle/${r.circle_id}`);
    } catch (e: any) { Alert.alert("Club chat", e?.message || "Could not open chat."); }
    finally { setBusy(false); }
  };

  const leave = () => Alert.alert("Leave club?", "You will lose access to the club chat.", [
    { text: "Cancel", style: "cancel" },
    { text: "Leave", style: "destructive", onPress: async () => {
      if (!id) return;
      try { await api.leaveClub(id); await load(); }
      catch (e: any) { Alert.alert("Could not leave", e?.message || "Try again."); }
    }},
  ]);

  if (loading) return <SafeAreaView style={styles.root} />;
  if (!club) return <SafeAreaView style={styles.root}><EmptyState title="Club not found" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}><Icon name="chevron-back" size={24} color={colors.onSurface} /></Pressable>
        <Text style={styles.headerTitle}>Club</Text><View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {club.image_url ? <Image source={{ uri: club.image_url }} style={styles.image} contentFit="cover" /> : <View style={styles.imageFallback}><Icon name="people" size={48} color={colors.brandPrimary} /></View>}
        <Text style={styles.category}>{(club.category || "CAMPUS CLUB").toUpperCase()}</Text>
        <Text style={styles.title}>{club.name}</Text>
        <View style={styles.metaRow}><Icon name="people-outline" size={17} color={colors.muted} /><Text style={styles.meta}>{club.member_ids?.length || 0} members</Text>{club.university ? <Text style={styles.meta}> · {club.university}</Text> : null}</View>
        {club.description ? <Text style={styles.description}>{club.description}</Text> : null}
        {(club.tags || []).length > 0 && <View style={styles.tags}>{club.tags.map((tag: string) => <Chip key={tag} label={tag} />)}</View>}

        <View style={styles.actions}>
          {club.is_member ? (
            <>
              <Button label="Open club chat" onPress={openChat} loading={busy} />
              {!club.is_creator && <Pressable onPress={leave} style={styles.leave}><Text style={styles.leaveText}>Leave club</Text></Pressable>}
              {club.is_creator && <Text style={styles.ownerNote}>You created this club</Text>}
            </>
          ) : <Button label="Join club" onPress={join} loading={busy} />}
        </View>
      </ScrollView>
      <MainTabBar />
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "800" },
  content: { padding: spacing.xl, paddingBottom: 130 },
  image: { width: "100%", height: 220, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary },
  imageFallback: { width: "100%", height: 220, borderRadius: radius.lg, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  category: { color: colors.brandPrimary, fontSize: 11, fontWeight: "900", letterSpacing: 1, marginTop: spacing.lg },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "900", marginTop: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  meta: { color: colors.muted, fontSize: 13, marginLeft: 5 },
  description: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 22, marginTop: spacing.xl },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xl },
  actions: { marginTop: 28, gap: 12 },
  leave: { alignItems: "center", paddingVertical: 12 },
  leaveText: { color: colors.error, fontSize: 13, fontWeight: "800" },
  ownerNote: { color: colors.muted, fontSize: 12, textAlign: "center" },
}));