import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
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

  useFocusEffect(useCallback(() => {
    (async () => {
      try {
        const r = await api.listCircles(true);
        setCircleCount((r.circles || []).length);
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
    try {
      await api.verifyStudent();
      await refresh();
    } finally {
      setVerifying(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.top}>
          <Pressable onPress={changePhoto} testID="profile-photo">
            <Avatar uri={user.profile_photo_url ?? null} name={user.first_name} size={96} />
            <View style={styles.cameraBadge}>
              <Icon name="camera" size={14} color={colors.onBrandPrimary} />
            </View>
          </Pressable>
          <Text style={styles.name}>{user.first_name} {user.last_name}</Text>
          <Text style={styles.meta}>{user.major || "Add your major"} · {user.year || "—"}</Text>

          <View style={styles.verifyRow}>
            {user.verified ? (
              <View style={styles.verifiedBadge}>
                <Icon name="checkmark-circle" size={14} color={colors.onBrandPrimary} />
                <Text style={styles.verifiedText}>CSUF Verified</Text>
              </View>
            ) : (
              <Pressable onPress={verify} testID="verify-student" style={styles.verifyBtn}>
                {verifying ? <Text style={styles.verifyText}>Verifying...</Text> : <Text style={styles.verifyText}>Verify student status</Text>}
              </Pressable>
            )}
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{user.interests.length}</Text>
            <Text style={styles.statLabel}>Interests</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{circleCount}</Text>
            <Text style={styles.statLabel}>Circles</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statNum}>{user.looking_for.length}</Text>
            <Text style={styles.statLabel}>Goals</Text>
          </View>
        </View>

        {user.bio && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.bio}>{user.bio}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <View style={styles.chips}>
            {user.interests.map((i) => <Chip key={i} label={i} selected />)}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Looking for</Text>
          <View style={styles.chips}>
            {user.looking_for.map((i) => <Chip key={i} label={i} />)}
          </View>
        </View>

        <View style={{ padding: spacing.xl }}>
          <Button label="Sign out" variant="secondary" onPress={async () => { await signOut(); router.replace("/(auth)/welcome"); }} testID="profile-signout" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  top: { alignItems: "center", padding: spacing.xl },
  cameraBadge: { position: "absolute", right: 0, bottom: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
  name: { fontSize: 22, fontWeight: "800", color: colors.onSurface, marginTop: spacing.md },
  meta: { color: colors.muted, fontSize: 14, marginTop: 2 },
  verifyRow: { marginTop: spacing.md },
  verifyBtn: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.brandTertiary },
  verifyText: { color: colors.onBrandTertiary, fontWeight: "600", fontSize: 13 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.brandPrimary },
  verifiedText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 12 },
  statsRow: { flexDirection: "row", padding: spacing.xl, gap: spacing.md },
  stat: { flex: 1, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, alignItems: "center" },
  statNum: { fontSize: 22, fontWeight: "800", color: colors.brandPrimary },
  statLabel: { fontSize: 12, color: colors.muted, marginTop: 2 },
  section: { paddingHorizontal: spacing.xl, marginTop: spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: colors.onSurface, marginBottom: spacing.sm },
  bio: { color: colors.onSurfaceSecondary, fontSize: 14, lineHeight: 20 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
