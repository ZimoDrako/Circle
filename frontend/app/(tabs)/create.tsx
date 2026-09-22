import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius } from "@/src/theme";
import { Button, Chip } from "@/src/ui";
import { api } from "@/src/api";

const CATEGORIES = ["Gaming", "Sports", "Food", "Study", "Culture", "Art", "Tech", "Outdoor", "Casual", "Networking", "Service"];

export default function Create() {
  const router = useRouter();
  const [mode, setMode] = useState<"pick" | "event" | "rec">("pick");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Casual");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submitEvent = async () => {
    if (!title.trim() || !description.trim() || !date.trim() || !time.trim() || !location.trim()) {
      setError("Complete the title, description, date, time, and location.");
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      setError("Use YYYY-MM-DD for the date.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const r = await api.createEvent({
        title, description, category, date, time, location,
        tags: [category], event_type: "student",
        cover_image_url: "https://images.unsplash.com/photo-1523580494863-6f3031224c94?w=900&q=80",
      });
      router.replace(`/event/${r.event.id}`);
    } catch (e: any) {
      setError(e?.message || "Could not create the event.");
    } finally {
      setSaving(false);
    }
  };

  const submitRec = async () => {
    if (!title.trim() || !description.trim()) {
      setError("Add a title and description.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await api.createRecommendation({
        title, description, category, location, tags: [category],
        image_url: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=900&q=80",
      });
      router.replace("/(tabs)/discover");
    } catch (e: any) {
      setError(e?.message || "Could not create the recommendation.");
    } finally {
      setSaving(false);
    }
  };

  if (mode === "pick") {
    return (
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.title}>Create</Text>
          <Text style={styles.sub}>Get something going in under 30 seconds.</Text>
        </View>
        <View style={{ padding: spacing.xl, gap: spacing.md }}>
          <ChoiceCard
            testID="create-event"
            icon="calendar"
            title="Create an Event"
            sub="Gaming night, pickup basketball, study session..."
            onPress={() => setMode("event")}
          />
          <ChoiceCard
            testID="create-rec"
            icon="star"
            title="Recommend Something"
            sub="Best food, hidden study spots, cool places."
            onPress={() => setMode("rec")}
          />
          <ChoiceCard
            testID="create-circle-link"
            icon="people"
            title="Start a Circle from an event"
            sub="Open any event → Find People to Go With."
            onPress={() => router.push("/(tabs)/discover")}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <SafeAreaView style={styles.root} edges={["top"]}>
        <View style={styles.formHeader}>
          <Pressable onPress={() => setMode("pick")} testID="create-back"><Icon name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
          <Text style={styles.formTitle}>{mode === "event" ? "New event" : "New recommendation"}</Text>
          <View style={{ width: 26 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingBottom: 100 }} keyboardShouldPersistTaps="handled">
          <Text style={styles.label}>Title</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Basketball tonight" placeholderTextColor={colors.muted} style={styles.input} testID="create-title" />
          <Text style={styles.label}>Description</Text>
          <TextInput value={description} onChangeText={setDescription} placeholder="Details..." placeholderTextColor={colors.muted} style={[styles.input, { minHeight: 90 }]} multiline testID="create-desc" />
          <Text style={styles.label}>Category</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((c) => (
              <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </View>
          {mode === "event" && (
            <>
              <Text style={styles.label}>Date</Text>
              {Platform.OS === "web" ? (
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.currentTarget.value)}
                  data-testid="create-date"
                  style={webPickerStyle}
                />
              ) : (
                <TextInput value={date} onChangeText={setDate} placeholder="MM/DD/YYYY" placeholderTextColor={colors.muted} style={styles.input} testID="create-date" />
              )}
              <Text style={styles.label}>Time</Text>
              {Platform.OS === "web" ? (
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.currentTarget.value)}
                  data-testid="create-time"
                  style={webPickerStyle}
                />
              ) : (
                <TextInput value={time} onChangeText={setTime} placeholder="7:00 PM" placeholderTextColor={colors.muted} style={styles.input} testID="create-time" />
              )}
            </>
          )}
          <Text style={styles.label}>Location</Text>
          <TextInput value={location} onChangeText={setLocation} placeholder="Student Rec Center" placeholderTextColor={colors.muted} style={styles.input} testID="create-location" />
        </ScrollView>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.footer}>
          <Button label={mode === "event" ? "Post event" : "Post recommendation"} onPress={mode === "event" ? submitEvent : submitRec} loading={saving} disabled={!title || !description} testID="create-submit" />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function ChoiceCard({ icon, title, sub, onPress, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.choice}>
      <View style={styles.iconWrap}>
        <Icon name={icon} size={22} color={colors.onBrandPrimary} />
      </View>
      <View style={{ flex: 1, marginLeft: spacing.md }}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceSub}>{sub}</Text>
      </View>
      <Icon name="chevron-forward" size={20} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { padding: spacing.xl },
  title: { fontSize: 26, fontWeight: "800", color: colors.onSurface },
  sub: { color: colors.muted, marginTop: 4, fontSize: 14 },
  choice: { flexDirection: "row", alignItems: "center", padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  iconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  choiceTitle: { color: colors.onSurface, fontWeight: "700", fontSize: 15 },
  choiceSub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  formHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  formTitle: { fontSize: 17, fontWeight: "700", color: colors.onSurface },
  label: { fontSize: 13, fontWeight: "600", color: colors.onSurface, marginTop: spacing.md, marginBottom: 6 },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 14, fontSize: 15, color: colors.onSurface, borderWidth: 1, borderColor: colors.border },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  error: { color: colors.error, fontSize: 13, paddingHorizontal: spacing.xl, paddingTop: spacing.sm },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.divider },
});

const webPickerStyle: any = {
  width: "100%",
  boxSizing: "border-box",
  borderRadius: radius.md,
  padding: "14px 16px",
  fontSize: 15,
  background: colors.surfaceSecondary,
  color: colors.onSurface,
  border: `1px solid ${colors.border}`,
  fontFamily: "inherit",
};
