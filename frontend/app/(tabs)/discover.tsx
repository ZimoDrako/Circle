import { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "@react-native-vector-icons/ionicons";
import { spacing, radius, useTheme, makeStyles } from "@/src/theme";
import { Avatar } from "@/src/ui";
import { api } from "@/src/api";

const FILTERS = ["For You", "Tonight", "This Week", "People", "Events", "Clubs"] as const;
const VIBES = [
  { label: "Food", icon: "restaurant-outline" },
  { label: "Study", icon: "book-outline" },
  { label: "Active", icon: "fitness-outline" },
  { label: "Gaming", icon: "game-controller-outline" },
  { label: "Creative", icon: "color-palette-outline" },
  { label: "Music", icon: "musical-notes-outline" },
  { label: "Social", icon: "people-outline" },
  { label: "Explore", icon: "compass-outline" },
] as const;

export default function Discover() {
  const { colors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("For You");
  const [events, setEvents] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [recs, setRecs] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);

  const load = useCallback(async () => {
    try {
      const [e, u, r, c] = await Promise.all([
        api.listEvents({ q: q || undefined }),
        q ? api.listUsers(q) : api.getMatches(),
        api.listRecommendations(q || undefined),
        api.listClubs(),
      ]);
      setEvents(e.events || []);
      setPeople(q ? (u.users || []) : (u.matches || []).map((m: any) => ({ ...m.user, compatibility: m.compatibility, reasons: m.reasons || [] })));
      setRecs(r.recommendations || []);
      setClubs(c.clubs || []);
    } catch {}
  }, [q]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const search = q.trim().toLowerCase();
  const includes = (item: any, fields: string[]) => !search || fields.some((key) => String(item?.[key] || "").toLowerCase().includes(search));
  const shownEvents = useMemo(() => events.filter((e) => includes(e, ["title", "category", "description", "location"])), [events, search]);
  const shownPeople = useMemo(() => people.filter((p) => includes(p, ["first_name", "last_name", "major"]) || (p.interests || []).some((i: string) => i.toLowerCase().includes(search))), [people, search]);
  const shownClubs = useMemo(() => clubs.filter((c) => includes(c, ["name", "description", "category"])), [clubs, search]);
  const shownRecs = useMemo(() => recs.filter((r) => includes(r, ["title", "description", "category"])), [recs, search]);

  const selectFilter = (value: string) => {
    setFilter(value);
    if (["People", "Events", "Clubs"].includes(value)) return;
    if (value !== "For You") setQ(value);
    else setQ("");
  };

  const browseVibe = (vibe: string) => {
    setFilter(vibe);
    setQ(vibe);
  };

  const SectionHead = ({ title, action }: { title: string; action?: string }) => (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {action ? <Pressable onPress={() => selectFilter(action)}><Text style={styles.seeAll}>See all →</Text></Pressable> : null}
    </View>
  );

  const eventCard = (e: any, featured = false) => (
    <Pressable key={e.id} onPress={() => router.push(`/event/${e.id}`)} style={[styles.eventCard, featured && styles.eventFeatured]}>
      {e.cover_image_url ? <Image source={{ uri: e.cover_image_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <View style={[StyleSheet.absoluteFill, styles.eventFallback]}><Icon name="calendar-outline" size={30} color={colors.brandPrimary} /></View>}
      <LinearGradient colors={["transparent", "rgba(0,0,0,0.86)"]} style={StyleSheet.absoluteFill} />
      <View style={styles.eventBody}>
        <Text style={styles.eventKicker}>{e.category || "EVENT"}</Text>
        <Text numberOfLines={2} style={styles.eventTitle}>{e.title}</Text>
        <Text numberOfLines={1} style={styles.eventMeta}>{[e.date, e.time, e.location].filter(Boolean).join(" · ")}</Text>
      </View>
    </Pressable>
  );

  const isSearch = q.trim().length > 0;
  const categoryOnly = ["People", "Events", "Clubs"].includes(filter);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Discover</Text>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput value={q} onChangeText={setQ} onSubmitEditing={load} placeholder="Search people, events, clubs, interests..." placeholderTextColor={colors.muted} style={styles.searchInput} />
          {!!q && <Pressable onPress={() => { setQ(""); setFilter("For You"); }}><Icon name="close-circle" size={18} color={colors.muted} /></Pressable>}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((item) => <Pressable key={item} onPress={() => selectFilter(item)} style={[styles.filterChip, filter === item && styles.filterChipActive]}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text></Pressable>)}
        </ScrollView>

        {isSearch || categoryOnly ? (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>{isSearch ? `Explore “${q}”` : filter}</Text>
            {(filter === "Events" || !categoryOnly) && shownEvents.slice(0, 8).map((e) => eventCard(e))}
            {(filter === "People" || !categoryOnly) && shownPeople.slice(0, 8).map((p) => (
              <Pressable key={p.id} onPress={() => router.push(`/match/${p.id}`)} style={styles.personRow}>
                <Avatar uri={p.profile_photo_url} name={p.first_name} size={52} />
                <View style={styles.personBody}><Text style={styles.personName}>{p.first_name} {p.last_name}</Text><Text numberOfLines={1} style={styles.personMeta}>{(p.interests || []).slice(0, 3).join(" · ") || p.major || "Student"}</Text></View>
                {typeof p.compatibility === "number" && <Text style={styles.match}>{p.compatibility}%</Text>}
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
            {(filter === "Clubs" || !categoryOnly) && shownClubs.slice(0, 8).map((c) => (
              <Pressable key={c.id} onPress={() => router.push(`/club/${c.id}`)} style={styles.clubRow}>
                {c.image_url ? <Image source={{ uri: c.image_url }} style={styles.clubIcon} contentFit="cover" /> : <View style={styles.clubIconFallback}><Icon name="people-outline" size={20} color={colors.brandPrimary} /></View>}
                <View style={styles.personBody}><Text style={styles.personName}>{c.name}</Text><Text numberOfLines={1} style={styles.personMeta}>{c.description || `${c.member_ids?.length || 0} members`}</Text></View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
            {!categoryOnly && shownRecs.slice(0, 4).map((r) => (
              <Pressable key={r.id} onPress={() => router.push(`/recommendation/${r.id}`)} style={styles.clubRow}>
                <View style={styles.clubIconFallback}><Icon name="sparkles-outline" size={20} color={colors.brandPrimary} /></View>
                <View style={styles.personBody}><Text style={styles.personName}>{r.title}</Text><Text numberOfLines={1} style={styles.personMeta}>{r.description}</Text></View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
            {shownEvents.length + shownPeople.length + shownClubs.length + shownRecs.length === 0 && <Text style={styles.empty}>Nothing here yet. Try another interest or category.</Text>}
          </View>
        ) : (
          <>
            <SectionHead title="Happening soon" action="Events" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
              {shownEvents.slice(0, 4).map((e) => eventCard(e, true))}
              {shownEvents.length === 0 && <View style={styles.emptyCard}><Icon name="calendar-outline" size={24} color={colors.brandPrimary} /><Text style={styles.emptyCardTitle}>Nothing scheduled yet</Text><Text style={styles.emptyCardText}>Check back as campus activity picks up.</Text></View>}
            </ScrollView>

            <SectionHead title="Explore by vibe" />
            <View style={styles.vibeGrid}>
              {VIBES.map((v) => <Pressable key={v.label} onPress={() => browseVibe(v.label)} style={styles.vibe}><View style={styles.vibeIcon}><Icon name={v.icon as any} size={20} color={colors.brandPrimary} /></View><Text style={styles.vibeText}>{v.label}</Text></Pressable>)}
            </View>

            <SectionHead title="People you might click with" action="People" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleStrip}>
              {shownPeople.slice(0, 5).map((p) => (
                <Pressable key={p.id} onPress={() => router.push(`/match/${p.id}`)} style={styles.personCard}>
                  <Avatar uri={p.profile_photo_url} name={p.first_name} size={64} />
                  <Text numberOfLines={1} style={styles.personCardName}>{p.first_name}</Text>
                  {typeof p.compatibility === "number" && <Text style={styles.match}>{p.compatibility}% match</Text>}
                  <Text numberOfLines={2} style={styles.personCardMeta}>{(p.interests || []).slice(0, 2).join(" · ") || p.major || "Student"}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <SectionHead title="Events for you" action="Events" />
            {shownEvents.slice(0, 2).map((e) => eventCard(e))}

            <SectionHead title="Clubs & communities" action="Clubs" />
            {shownClubs.slice(0, 3).map((c) => (
              <Pressable key={c.id} onPress={() => router.push(`/club/${c.id}`)} style={styles.clubRow}>
                {c.image_url ? <Image source={{ uri: c.image_url }} style={styles.clubIcon} contentFit="cover" /> : <View style={styles.clubIconFallback}><Icon name="people-outline" size={20} color={colors.brandPrimary} /></View>}
                <View style={styles.personBody}><Text style={styles.personName}>{c.name}</Text><Text numberOfLines={1} style={styles.personMeta}>{c.description || `${c.member_ids?.length || 0} members`}</Text></View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}

            {shownRecs.length > 0 && <>
              <SectionHead title="Try something different" />
              <Pressable onPress={() => router.push(`/recommendation/${shownRecs[0].id}`)} style={styles.tryCard}>
                {shownRecs[0].image_url ? <Image source={{ uri: shownRecs[0].image_url }} style={styles.tryImage} contentFit="cover" /> : <View style={styles.tryImageFallback}><Icon name="sparkles-outline" size={25} color={colors.brandPrimary} /></View>}
                <View style={styles.tryBody}><Text style={styles.tryKicker}>EXPLORE SOMETHING NEW</Text><Text style={styles.tryTitle}>{shownRecs[0].title}</Text><Text numberOfLines={2} style={styles.tryText}>{shownRecs[0].description}</Text></View>
              </Pressable>
            </>}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, backgroundColor: colors.surface },
  page: { paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: 52 },
  title: { fontSize: 29, fontWeight: "900", color: colors.onSurface, letterSpacing: -0.7, marginBottom: spacing.md },
  searchBox: { flexDirection: "row", alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.md, minHeight: 46, borderWidth: 1, borderColor: colors.border },
  searchInput: { flex: 1, marginLeft: spacing.sm, color: colors.onSurface, fontSize: 14 },
  filters: { gap: 8, paddingVertical: spacing.md, paddingRight: spacing.xl },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  filterText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  filterTextActive: { color: colors.onBrandPrimary },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 24, marginBottom: 11 },
  sectionTitle: { color: colors.onSurface, fontSize: 19, fontWeight: "900", letterSpacing: -0.3 },
  seeAll: { color: colors.brandPrimary, fontSize: 12, fontWeight: "800" },
  horizontalCards: { gap: 12, paddingRight: spacing.xl },
  eventCard: { height: 158, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary, marginBottom: 11 },
  eventFeatured: { width: 275, height: 174, marginBottom: 0 },
  eventFallback: { backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  eventBody: { position: "absolute", left: 15, right: 15, bottom: 14 },
  eventKicker: { color: "#FFFFFF", fontSize: 9, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
  eventTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "900", marginTop: 3 },
  eventMeta: { color: "rgba(255,255,255,0.85)", fontSize: 11, marginTop: 5 },
  vibeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 },
  vibe: { width: "23%", alignItems: "center", paddingVertical: 12, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider },
  vibeIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  vibeText: { color: colors.onSurface, fontSize: 11, fontWeight: "800", marginTop: 7 },
  peopleStrip: { gap: 10, paddingRight: spacing.xl },
  personCard: { width: 132, minHeight: 160, alignItems: "center", padding: 13, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider },
  personCardName: { color: colors.onSurface, fontSize: 14, fontWeight: "900", marginTop: 8 },
  personCardMeta: { color: colors.muted, fontSize: 10, lineHeight: 14, textAlign: "center", marginTop: 5 },
  match: { color: colors.brandPrimary, fontSize: 10, fontWeight: "900", marginTop: 2 },
  clubRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.divider },
  clubIcon: { width: 50, height: 50, borderRadius: 14, backgroundColor: colors.surfaceSecondary },
  clubIconFallback: { width: 50, height: 50, borderRadius: 14, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  personRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider },
  personBody: { flex: 1, minWidth: 0 },
  personName: { color: colors.onSurface, fontSize: 14, fontWeight: "900" },
  personMeta: { color: colors.muted, fontSize: 11, marginTop: 3 },
  tryCard: { flexDirection: "row", borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.divider },
  tryImage: { width: 108, minHeight: 112 },
  tryImageFallback: { width: 108, minHeight: 112, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  tryBody: { flex: 1, padding: 13 },
  tryKicker: { color: colors.brandPrimary, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  tryTitle: { color: colors.onSurface, fontSize: 15, fontWeight: "900", marginTop: 4 },
  tryText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4 },
  results: { paddingTop: 8 },
  resultsTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "900", marginBottom: 12 },
  empty: { color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 50 },
  emptyCard: { width: 275, height: 174, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", padding: 20 },
  emptyCardTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "900", marginTop: 8 },
  emptyCardText: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 4 },
}));
