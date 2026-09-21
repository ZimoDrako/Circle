import { useState } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius } from "@/src/theme";
import { Button } from "@/src/ui";
import { api, setToken } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function Login() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr("");
    setLoading(true);
    try {
      const r = await api.login({ email, password });
      await setToken(r.token);
      await refresh();
      if (!r.user.onboarded) router.replace("/onboarding/1");
      else router.replace("/(tabs)/home");
    } catch (e: any) {
      setErr(e.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="login-back">
            <Icon name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.sub}>Sign in to your CIRCLE account.</Text>

          <View style={{ height: spacing.xl }} />
          <Text style={styles.label}>Email</Text>
          <TextInput
            testID="login-email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <View style={{ height: spacing.md }} />
          <Text style={styles.label}>Password</Text>
          <TextInput
            testID="login-password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholderTextColor={colors.muted}
            style={styles.input}
          />

          {err ? <Text style={styles.err}>{err}</Text> : null}
          <View style={{ height: spacing.xl }} />
          <Button label="Sign in" onPress={submit} loading={loading} testID="login-submit" />

          <View style={styles.demoBox}>
            <Text style={styles.demoTitle}>Try the demo</Text>
            <Text style={styles.demoText}>demo0@circle.demo · password: demo1234</Text>
          </View>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  body: { padding: spacing.xl },
  title: { fontSize: 28, fontWeight: "800", color: colors.onSurface },
  sub: { fontSize: 14, color: colors.muted, marginTop: spacing.xs },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurface, marginBottom: 6 },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.onSurface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  err: { color: colors.error, marginTop: spacing.md },
  demoBox: {
    marginTop: spacing.xl,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  demoTitle: { fontWeight: "700", color: colors.onSurface, marginBottom: 4 },
  demoText: { fontSize: 12, color: colors.muted },
});
