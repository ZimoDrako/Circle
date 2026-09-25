import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius, useTheme, makeStyles } from "@/src/theme";
import { Avatar } from "@/src/ui";
import { api } from "@/src/api";
import { MainTabBar } from "@/src/components/main-tab-bar";

export default function RecommendationDetail() {
  const { colors: themeColors } = useTheme();
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [recommendation, setRecommendation] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const result = await api.getRecommendation(id!);
      setRecommendation(result.recommendation);
    } catch {}
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!recommendation) {
    return <SafeAreaView style={styles.root}><Text style={styles.loading}>Loading...</Text></SafeAreaView>;
  }

  const r = recommendation;
  return (
    <View style={styles.root}>
      <SafeAreaView edges={["top"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.replace("/(tabs)/discover")} testID="recommendation-back">
            <Icon name="chevron-back" size={26} color={themeColors.onSurface} />
          </Pressable>
          <Text style={styles.headerTitle}>Recommendation</Text>
          <View style={{ width: 26 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.content}>
        {r.image_url ? <Image source={{ uri: r.image_url }} style={styles.image} contentFit="cover" /> : null}
        <Text style={styles.category}>{(r.category || "Recommendation").toUpperCase()}</Text>
        <Text style={styles.title}>{r.title}</Text>

        {r.location ? (
          <View style={styles.metaRow}>
            <Icon name="location-outline" size={17} color={themeColors.brandPrimary} />
            <Text style={styles.meta}>{r.location}</Text>
          </View>
        ) : null}

        <Text style={styles.description}>{r.description}</Text>

        <View style={styles.creator}>
          <Avatar uri={r.creator_photo} name={r.creator_name} size={40} />
          <View style={{ marginLeft: spacing.sm }}>
            <Text style={styles.recommendedBy}>Recommended by</Text>
            <Text style={styles.creatorName}>{r.creator_name}</Text>
          </View>
        </View>

        {(r.tags || []).length > 0 ? (
          <View style={styles.tags}>
            {r.tags.map((tag: string) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}
          </View>
        ) : null}
      </ScrollView>
      <MainTabBar />
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  loading: { padding: 24, color: colors.muted },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  headerTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  content: { padding: spacing.xl, paddingTop: spacing.md, paddingBottom: 48 },
  image: { width: "100%", height: 220, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, marginBottom: spacing.lg },
  category: { color: colors.brandPrimary, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  title: { color: colors.onSurface, fontSize: 28, lineHeight: 34, fontWeight: "800", marginTop: 5 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md },
  meta: { color: colors.onSurfaceSecondary, fontSize: 14, fontWeight: "600" },
  description: { color: colors.onSurfaceSecondary, fontSize: 15, lineHeight: 23, marginTop: spacing.xl },
  creator: { flexDirection: "row", alignItems: "center", marginTop: spacing.xl, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary },
  recommendedBy: { color: colors.muted, fontSize: 11 },
  creatorName: { color: colors.onSurface, fontSize: 14, fontWeight: "700", marginTop: 2 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.lg },
  tag: { paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary },
  tagText: { color: colors.brandPrimary, fontSize: 12, fontWeight: "600" },
}));
