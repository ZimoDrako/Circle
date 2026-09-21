import { useState } from "react";
import { View, Text, TextInput, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius } from "@/src/theme";
import { Button } from "@/src/ui";
import { api, setToken } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function SignUp() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [dob, setDob] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setErr("");
    if (!first || !last || !email || !password || !dob) {
      setErr("Please fill everything");
      return;
    }
    if (password.length < 8) {
      setErr("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const r = await api.signup({
        first_name: first,
        last_name: last,
        email,
        password,
        date_of_birth: dob,
        university: "California State University, Fullerton",
      });
      await setToken(r.token);
      await refresh();
      router.replace("/onboarding/1");
    } catch (e: any) {
      setErr(e.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="signup-back">
            <Icon name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.sub}>Use any email. You'll verify your CSUF status later.</Text>

          <View style={{ height: spacing.xl }} />
          <View style={styles.row}>
            <Field label="First name" value={first} onChangeText={setFirst} testID="signup-first" style={{ flex: 1 }} />
            <View style={{ width: spacing.md }} />
            <Field label="Last name" value={last} onChangeText={setLast} testID="signup-last" style={{ flex: 1 }} />
          </View>
          <Field label="Email" value={email} onChangeText={setEmail} testID="signup-email" keyboardType="email-address" autoCapitalize="none" />
          <Field label="Password" value={password} onChangeText={setPassword} testID="signup-password" secureTextEntry />
          <Field label="Date of birth (YYYY-MM-DD)" value={dob} onChangeText={setDob} testID="signup-dob" placeholder="2003-01-15" />

          <View style={styles.uniBox}>
            <Icon name="school-outline" size={18} color={colors.brandPrimary} />
            <Text style={styles.uniText}>California State University, Fullerton</Text>
          </View>

          {err ? <Text style={styles.err}>{err}</Text> : null}
        </ScrollView>
        <View style={styles.footer}>
          <Button label="Create account" onPress={submit} loading={loading} testID="signup-submit" />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, style, testID, ...props }: any) {
  return (
    <View style={[{ marginBottom: spacing.md }, style]}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={styles.input}
        testID={testID}
        {...props}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  body: { padding: spacing.xl, paddingBottom: 120 },
  title: { fontSize: 28, fontWeight: "800", color: colors.onSurface },
  sub: { fontSize: 14, color: colors.muted, marginTop: spacing.xs },
  row: { flexDirection: "row" },
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
  uniBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.brandTertiary,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  uniText: { color: colors.onBrandTertiary, fontWeight: "600" },
  err: { color: colors.error, marginTop: spacing.md },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.divider },
});
