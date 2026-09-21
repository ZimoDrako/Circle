import { View, Text, StyleSheet, Pressable } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing, radius } from "@/src/theme";
import { Button } from "@/src/ui";

export default function Welcome() {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <Image
        source={{
          uri: "https://images.pexels.com/photos/7683897/pexels-photo-7683897.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
        }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
      />
      <LinearGradient
        colors={["transparent", "rgba(9,9,11,0.55)", "rgba(9,9,11,0.95)"]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.top}>
          <View style={styles.logoRow}>
            <View style={styles.logoDot} />
            <Text style={styles.logo}>CIRCLE</Text>
          </View>
        </View>
        <View style={styles.bottom}>
          <Text style={styles.title}>Find your people.{"\n"}Find something to do.</Text>
          <Text style={styles.subtitle}>
            A social discovery app for students who want to meet people, join events, and actually show up together.
          </Text>
          <View style={{ height: spacing.xl }} />
          <Button
            testID="welcome-signup-button"
            label="Get started"
            onPress={() => router.push("/(auth)/signup")}
          />
          <View style={{ height: spacing.md }} />
          <Pressable testID="welcome-login-button" onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.loginLink}>I already have an account</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceInverse },
  safe: { flex: 1, paddingHorizontal: spacing.xl, justifyContent: "space-between" },
  top: { paddingTop: spacing.lg },
  logoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.brandPrimary },
  logo: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", letterSpacing: 2 },
  bottom: { paddingBottom: spacing.xl },
  title: { color: "#FFFFFF", fontSize: 32, fontWeight: "800", lineHeight: 38 },
  subtitle: { color: "rgba(255,255,255,0.85)", fontSize: 15, marginTop: spacing.md, lineHeight: 22 },
  loginLink: { color: "#FFFFFF", textAlign: "center", fontWeight: "600", fontSize: 15, paddingVertical: 12 },
});
