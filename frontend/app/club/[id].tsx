import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius } from "@/src/theme";
import { Chip, EmptyState } from "@/src/ui";
import { api } from "@/src/api";
import { MainTabBar } from "@/src/components/main-tab-bar";

export default function ClubDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [club, setClub] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await api.getClub(id);
      setClub(r.club);
    } catch {
      setClub(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) return <SafeAreaView style={styles.root} />;
  if (!club) return <SafeAreaView style={styles.root}><EmptyState title="Club not found" /></SafeAreaView>;

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/(tabs)/discover")} style={styles.back} testID="club-back">
          <Icon name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.headerTitle}>Club</Text>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Image source={{ uri: club.image_url }} style={styles.image} contentFit="cover" />
        <Text style={styles.category}>{(club.category || "CAMPUS CLUB").toUpperCase()}</Text>
        <Text style={styles.title}>{club.name}</Text>
        <View style={styles.metaRow}>
          <Icon name="people-outline" size={17} color={colors.muted} />
          <Text style={styles.meta}>{club.member_ids?.length || 0} members</Text>
          {club.university ? <Text style={styles.meta}> · {club.university}</Text> : null}
        </View>
        {club.description ? <Text style={styles.description}>{club.description}</Text> : null}
        {(club.tags || []).length > 0 && (
          <View style={styles.tags}>
            {club.tags.map((tag: string) => <Chip key={tag} label={tag} />)}
          </View>
        )}
      </ScrollView>
      <MainTabBar />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  back: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "700" },
  content: { padding: spacing.xl, paddingBottom: 110 },
  image: { width: "100%", height: 220, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary },
  category: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1, marginTop: spacing.lg },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "800", marginTop: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: spacing.sm },
  meta: { color: colors.muted, fontSize: 13, marginLeft: 5 },
  description: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 22, marginTop: spacing.xl },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xl },
});
