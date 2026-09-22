import { useState, useMemo, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { colors, spacing, radius } from "@/src/theme";
import { Button, Chip } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LOOKING_FOR = [
  "New friends", "Dating", "Study partners", "Gym partners", "Gaming partners",
  "People to attend events with", "Networking", "Exploring campus", "Just meeting people",
];

const INTEREST_CATEGORIES = [
  { name: "Gaming", items: ["Gaming", "PC Gaming", "PlayStation", "Xbox", "Nintendo", "Mobile Gaming", "Esports", "Competitive Gaming", "RPGs", "Fighting Games", "Sports Games", "Cozy Games", "Board Games", "TCG"] },
  { name: "Anime & Fandom", items: ["Anime", "Manga", "Cosplay", "Comics", "Marvel", "DC", "Star Wars", "K-pop", "Japanese Culture"] },
  { name: "Music", items: ["Music", "Hip-hop", "Rap", "R&B", "Pop", "Rock", "Indie", "EDM", "Country", "Latin Music", "Jazz", "K-pop", "Concerts", "Festivals", "DJing", "Music Production", "Singing", "Songwriting"] },
  { name: "Sports & Fitness", items: ["Sports", "Basketball", "NBA", "Football", "Soccer", "Baseball", "Volleyball", "Tennis", "Golf", "MMA", "Boxing", "Wrestling", "Running", "Gym", "Fitness", "Weightlifting", "Yoga", "Pilates", "Cycling", "Skating", "Surfing", "Climbing"] },
  { name: "Creative", items: ["Art", "Drawing", "Painting", "Design", "Photography", "Film", "Movies", "TV", "Acting", "Theater", "Dance", "Writing", "Content Creation", "Fashion", "Streetwear", "Sneakers", "Thrifting"] },
  { name: "Tech & Career", items: ["Technology", "AI", "Coding", "Cybersecurity", "Robotics", "Engineering", "Hackathons", "Entrepreneurship", "Startups", "Business", "Finance", "Investing", "Marketing", "Networking"] },
  { name: "Food & Going Out", items: ["Food", "Restaurants", "Cooking", "Baking", "Coffee", "Cafes", "Boba", "Nightlife", "Parties", "Karaoke", "Comedy", "Live Music"] },
  { name: "Outdoors & Travel", items: ["Travel", "Road Trips", "Hiking", "Camping", "Outdoors", "Beach", "Nature", "Fishing", "Snowboarding", "Skiing", "Languages"] },
  { name: "Campus & Community", items: ["Study Sessions", "Student Clubs", "Greek Life", "Campus Events", "Volunteering", "Community Service", "Activism", "Religion & Spirituality", "Cultural Organizations"] },
  { name: "Lifestyle", items: ["Books", "Reading", "Book Clubs", "Podcasts", "Pets", "Wellness", "Meditation", "Nutrition", "Cars", "Car Meets", "Motorsports", "DIY", "Gardening"] },
];

const SOCIAL_QUESTIONS = [
  { id: "arrival", q: "You walk into an event where you don't know anyone. What do you usually do?", options: ["Start talking to people", "Find one approachable person", "Wait for someone to talk to me", "Stay with whoever I came with", "Probably leave"] },
  { id: "new_people", q: "When you're around a completely new group, what feels most natural?", options: ["Jump into conversations", "Introduce myself to a few people", "Warm up slowly", "Mostly observe first", "Keep to myself"] },
  { id: "friday_night", q: "What's your ideal Friday night?", options: ["Large party", "Small group hangout", "Gaming", "Food adventure", "Gym / sports", "Movie", "Staying home"] },
  { id: "spontaneous", q: "Someone texts: 'We're getting food in 20 minutes, you coming?'", options: ["Absolutely", "Probably", "Maybe", "Probably not", "No chance"] },
  { id: "plans_change", q: "Your plans suddenly change at the last minute. How do you react?", options: ["I'm into it", "Usually fine with it", "Depends", "I'd rather keep the plan", "I hate last-minute changes"] },
  { id: "group_size", q: "What group size do you enjoy most?", options: ["1-on-1", "2-3 people", "4-6 people", "7-12 people", "Large groups"] },
  { id: "conversation", q: "What kind of conversation makes you lose track of time?", options: ["Jokes and random stuff", "Stories and gossip", "A mix", "Ideas and goals", "Deep personal conversations"] },
  { id: "weekend_energy", q: "After a long week, what sounds best?", options: ["Go somewhere busy", "Do something active", "Hang with a few people", "Low-key plans", "Recharge alone"] },
  { id: "social_battery", q: "After spending several hours with people, you're usually…", options: ["Still ready for more", "Pretty energized", "Fine either way", "Ready to wind down", "Definitely need alone time"] },
  { id: "invite_style", q: "If your group has no plans, what are you most likely to do?", options: ["Make the plan myself", "Suggest a few ideas", "Ask what everyone wants", "Wait for someone else", "Probably do my own thing"] },
];

const PERSONALITY = [
  { id: "extroversion", left: "Introverted", right: "Extroverted" },
  { id: "spontaneity", left: "Planner", right: "Spontaneous" },
  { id: "energy", left: "Chill", right: "High energy" },
  { id: "depth", left: "Casual chats", right: "Deep talks" },
  { id: "competitive", left: "Relaxed", right: "Competitive" },
  { id: "adventurous", left: "Routine", right: "Adventurous" },
  { id: "initiative", left: "Go with the flow", right: "Make the plans" },
  { id: "party_level", left: "Low-key", right: "Party person" },
  { id: "activity_level", left: "Homebody", right: "Always out" },
];

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const TIMES = ["Morning", "Afternoon", "Evening", "Late night"];
const YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Grad"];
const ONBOARDING_KEY = "circle.onboarding.v2";

type State = {
  looking_for: string[];
  interests: string[];
  social_style: Record<string, number>;
  personality: Record<string, number>;
  year?: string;
  major?: string;
  lives_on_campus?: boolean;
  campus_area?: string;
  availability_days: string[];
  availability_times: string[];
  profile_photo_url?: string;
};

export default function OnboardingStep() {
  const { step } = useLocalSearchParams<{ step: string }>();
  const stepN = Math.max(1, Math.min(7, parseInt(String(step || "1"), 10)));
  const router = useRouter();
  const { refresh } = useAuth();
  const [state, setState] = useState<State>({
    looking_for: [],
    interests: [],
    social_style: {},
    personality: { extroversion: 50, spontaneity: 50, energy: 50, depth: 50, competitive: 50, adventurous: 50, initiative: 50, party_level: 50, activity_level: 50 },
    availability_days: [],
    availability_times: [],
  });
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((raw) => {
        if (raw) setState((current) => ({ ...current, ...JSON.parse(raw) }));
      })
      .catch(() => {})
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(ONBOARDING_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, hydrated]);

  const finish = async () => {
    setSaving(true);
    try {
      await api.saveOnboarding({ ...state, onboarding_version: 2 });
      await AsyncStorage.removeItem(ONBOARDING_KEY);
      await refresh();
      router.replace("/(tabs)/home");
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    if (stepN === 7) finish();
    else router.push(`/onboarding/${stepN + 1}`);
  };

  const canProceed = useMemo(() => {
    if (stepN === 1) return state.looking_for.length > 0;
    if (stepN === 2) return state.interests.length >= 5;
    if (stepN === 3) return Object.keys(state.social_style).length === SOCIAL_QUESTIONS.length;
    return true;
  }, [stepN, state]);

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <SafeAreaView style={styles.root} edges={["top", "bottom"]}>
        <View style={styles.header}>
          <Pressable onPress={() => (stepN === 1 ? router.back() : router.push(`/onboarding/${stepN - 1}`))}>
            <Icon name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <View style={styles.progressWrap}>
            <View style={[styles.progressBar, { width: `${(stepN / 7) * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{stepN}/7</Text>
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {stepN === 1 && (
            <StepWrap title="What are you looking for?" sub="Pick anything that fits. Choose more than one.">
              <View style={styles.wrap}>
                {LOOKING_FOR.map((x) => (
                  <Chip
                    key={x}
                    label={x}
                    selected={state.looking_for.includes(x)}
                    onPress={() =>
                      setState((s) => ({
                        ...s,
                        looking_for: s.looking_for.includes(x)
                          ? s.looking_for.filter((v) => v !== x)
                          : [...s.looking_for, x],
                      }))
                    }
                  />
                ))}
              </View>
            </StepWrap>
          )}

          {stepN === 2 && (
            <StepWrap title="What are you into?" sub="Pick at least 5. Specific interests help Circle find better people and introduce you to new things.">
              {INTEREST_CATEGORIES.map((category) => (
                <View key={category.name} style={styles.interestSection}>
                  <Text style={styles.categoryTitle}>{category.name}</Text>
                  <View style={styles.wrap}>
                    {category.items.map((x) => (
                      <Chip
                        key={x}
                        label={x}
                        selected={state.interests.includes(x)}
                        onPress={() =>
                          setState((s) => ({
                            ...s,
                            interests: s.interests.includes(x) ? s.interests.filter((v) => v !== x) : [...s.interests, x],
                          }))
                        }
                      />
                    ))}
                  </View>
                </View>
              ))}
            </StepWrap>
          )}

          {stepN === 3 && (
            <StepWrap title="Your social style" sub="No wrong answers. Helps us find your people.">
              {SOCIAL_QUESTIONS.map((q) => (
                <View key={q.id} style={styles.qBlock}>
                  <Text style={styles.qText}>{q.q}</Text>
                  <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                    {q.options.map((opt, idx) => {
                      const selected = state.social_style[q.id] === idx;
                      return (
                        <Pressable
                          key={opt}
                          onPress={() => setState((s) => ({ ...s, social_style: { ...s.social_style, [q.id]: idx } }))}
                          style={[styles.optionRow, selected && styles.optionRowSelected]}
                        >
                          <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{opt}</Text>
                          {selected && <Icon name="checkmark-circle" color={colors.brandPrimary} size={20} />}
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </StepWrap>
          )}

          {stepN === 4 && (
            <StepWrap title="Personality" sub="Slide to describe how you show up.">
              {PERSONALITY.map((p) => {
                const v = state.personality[p.id] ?? 50;
                return (
                  <View key={p.id} style={styles.qBlock}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={styles.persLabel}>{p.left}</Text>
                      <Text style={styles.persLabel}>{p.right}</Text>
                    </View>
                    <View style={styles.sliderTrack}>
                      {[0, 25, 50, 75, 100].map((tick) => (
                        <Pressable
                          key={tick}
                          onPress={() => setState((s) => ({ ...s, personality: { ...s.personality, [p.id]: tick } }))}
                          style={styles.sliderTick}
                          hitSlop={12}
                        >
                          <View style={[styles.sliderDot, v === tick && styles.sliderDotActive]} />
                        </Pressable>
                      ))}
                    </View>
                  </View>
                );
              })}
            </StepWrap>
          )}

          {stepN === 5 && (
            <StepWrap title="Campus life" sub="Helps us match you with people in your world.">
              <Text style={styles.subLabel}>Year</Text>
              <View style={styles.wrap}>
                {YEARS.map((y) => (
                  <Chip
                    key={y}
                    label={y}
                    selected={state.year === y}
                    onPress={() => setState((s) => ({ ...s, year: y }))}
                  />
                ))}
              </View>
              <Text style={[styles.subLabel, { marginTop: spacing.lg }]}>Major</Text>
              <TextInput
                value={state.major}
                onChangeText={(t) => setState((s) => ({ ...s, major: t }))}
                placeholder="e.g. Computer Science"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <Text style={[styles.subLabel, { marginTop: spacing.lg }]}>Live on campus?</Text>
              <View style={styles.wrap}>
                <Chip label="Yes" selected={state.lives_on_campus === true} onPress={() => setState((s) => ({ ...s, lives_on_campus: true }))} />
                <Chip label="No" selected={state.lives_on_campus === false} onPress={() => setState((s) => ({ ...s, lives_on_campus: false }))} />
              </View>
            </StepWrap>
          )}

          {stepN === 6 && (
            <StepWrap title="When are you free?" sub="We'll surface events that fit your schedule.">
              <Text style={styles.subLabel}>Days</Text>
              <View style={styles.wrap}>
                {DAYS.map((d) => (
                  <Chip
                    key={d}
                    label={d.slice(0, 3)}
                    selected={state.availability_days.includes(d)}
                    onPress={() =>
                      setState((s) => ({
                        ...s,
                        availability_days: s.availability_days.includes(d)
                          ? s.availability_days.filter((v) => v !== d)
                          : [...s.availability_days, d],
                      }))
                    }
                  />
                ))}
              </View>
              <Text style={[styles.subLabel, { marginTop: spacing.lg }]}>Times</Text>
              <View style={styles.wrap}>
                {TIMES.map((t) => (
                  <Chip
                    key={t}
                    label={t}
                    selected={state.availability_times.includes(t)}
                    onPress={() =>
                      setState((s) => ({
                        ...s,
                        availability_times: s.availability_times.includes(t)
                          ? s.availability_times.filter((v) => v !== t)
                          : [...s.availability_times, t],
                      }))
                    }
                  />
                ))}
              </View>
            </StepWrap>
          )}

          {stepN === 7 && (
            <StepWrap title="Add a photo" sub="Optional. Friends recognize friends by face.">
              <View style={{ alignItems: "center", marginTop: spacing.xl }}>
                <Pressable
                  onPress={async () => {
                    const res = await ImagePicker.launchImageLibraryAsync({
                      mediaTypes: ["images"],
                      quality: 0.7,
                    });
                    if (!res.canceled && res.assets[0]) {
                      try {
                        const up = await api.uploadImage(res.assets[0].uri);
                        setState((s) => ({ ...s, profile_photo_url: up.url }));
                      } catch {}
                    }
                  }}
                  style={styles.photoPicker}
                >
                  {state.profile_photo_url ? (
                    <Image source={{ uri: state.profile_photo_url }} style={styles.photo} contentFit="cover" />
                  ) : (
                    <>
                      <Icon name="camera-outline" size={40} color={colors.brandPrimary} />
                      <Text style={{ color: colors.onSurface, fontWeight: "600", marginTop: spacing.sm }}>Tap to add photo</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </StepWrap>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Button
            testID={`onboarding-continue-${stepN}`}
            label={stepN === 7 ? (saving ? "Finishing..." : "Finish") : "Continue"}
            onPress={next}
            loading={saving}
            disabled={!canProceed}
          />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function StepWrap({ title, sub, children }: { title: string; sub: string; children: any }) {
  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>{sub}</Text>
      <View style={{ height: spacing.xl }} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.md },
  progressWrap: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  progressBar: { height: 6, backgroundColor: colors.brandPrimary, borderRadius: 3 },
  progressText: { color: colors.muted, fontWeight: "600", fontSize: 12 },
  body: { padding: spacing.xl, paddingBottom: 120 },
  title: { fontSize: 24, fontWeight: "800", color: colors.onSurface },
  sub: { fontSize: 14, color: colors.muted, marginTop: spacing.xs },
  subLabel: { fontSize: 13, fontWeight: "600", color: colors.onSurface, marginBottom: spacing.sm },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  interestSection: { marginBottom: spacing.xl },
  categoryTitle: { fontSize: 15, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.sm },
  qBlock: { marginBottom: spacing.xl },
  qText: { fontSize: 15, fontWeight: "600", color: colors.onSurface },
  optionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionRowSelected: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  optionText: { color: colors.onSurface, fontSize: 14 },
  optionTextSelected: { color: colors.onBrandTertiary, fontWeight: "600" },
  persLabel: { fontSize: 13, color: colors.muted, fontWeight: "600" },
  sliderTrack: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md, height: 32 },
  sliderTick: { flex: 1, alignItems: "center" },
  sliderDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.surfaceTertiary },
  sliderDotActive: { backgroundColor: colors.brandPrimary, width: 22, height: 22, borderRadius: 11 },
  input: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, paddingHorizontal: spacing.lg,
    paddingVertical: 14, fontSize: 15, color: colors.onSurface, borderWidth: 1, borderColor: colors.border,
  },
  photoPicker: {
    width: 180, height: 180, borderRadius: 90, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderStyle: "dashed", borderColor: colors.brandPrimary,
  },
  photo: { width: 180, height: 180, borderRadius: 90 },
  footer: { padding: spacing.xl, borderTopWidth: 1, borderTopColor: colors.divider },
});
