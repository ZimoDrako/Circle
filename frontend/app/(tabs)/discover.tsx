import { useCallback, useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, RefreshControl, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "@react-native-vector-icons/ionicons";
import { spacing, radius, useTheme, makeStyles } from "@/src/theme";
import { Avatar } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { matchesSearch, matchesVibe, relevance, vibeTerms, isTonight, isThisWeek, isUpcoming, chronological, visibleKinds } from "@/src/discovery";

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
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("For You");
  const [events, setEvents] = useState<any[]>([]);
  const [people, setPeople] = useState<any[]>([]);
  const [recommendedIds, setRecommendedIds] = useState<string[]>([]);
  const [recs, setRecs] = useState<any[]>([]);
  const [clubs, setClubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [visibleCount, setVisibleCount] = useState(8);
  const [clock, setClock] = useState(() => new Date());
  const requestId = useRef(0);

  // Fetch the browse collections once per focus/refresh. Search stays local so it
  // can match interests, full names, locations and tags without racing requests.
  const load = useCallback(async (refresh = false) => {
    const request = ++requestId.current;
    setLoading(true);
    setRefreshing(refresh);
    setError("");
    const results = await Promise.allSettled([
      api.listEvents(), api.listUsers(), api.getMatches(),
      api.listRecommendations(), api.listClubs(),
    ]);
    if (request !== requestId.current) return;
    const [eventResult, userResult, matchResult, recResult, clubResult] = results;
    const matches = matchResult.status === "fulfilled" ? matchResult.value.matches || [] : [];
    const byId = new Map<string, any>(matches.map((m: any) => [m.user.id, m]));
    // Use the directory's visibility/block filtering for every displayed person.
    const directory = userResult.status === "fulfilled" ? userResult.value.users || [] : [];
    setPeople(directory.map((person: any) => {
      const match = byId.get(person.id);
      return { ...person, compatibility: match?.compatibility,
        reasons: match?.reasons || [], shared_interests: match?.shared_interests || [] };
    }));
    setRecommendedIds(matches.map((m: any) => m.user.id));
    setEvents(eventResult.status === "fulfilled" ? eventResult.value.events || [] : []);
    setRecs(recResult.status === "fulfilled" ? recResult.value.recommendations || [] : []);
    setClubs(clubResult.status === "fulfilled" ? clubResult.value.clubs || [] : []);
    const labels = ["events", "people", "match suggestions", "recommendations", "clubs"];
    const failed = results.flatMap((result, index) => result.status === "rejected" ? [labels[index]] : []);
    setError(failed.length ? `Couldn't load ${failed.join(", ")}. Please try again.` : "");
    setClock(new Date());
    setLoaded(true);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => {
    void load();
    const timer = setInterval(() => setClock(new Date()), 60000);
    return () => { requestId.current += 1; clearInterval(timer); };
  }, [load]));

  const search = q.trim();
  const userInterests = useMemo<string[]>(() => (user as any)?.interests || [], [user]);
  const upcoming = useMemo(() => events.filter(e => isUpcoming(e, clock)).sort(chronological), [events, clock]);
  const shownEvents = useMemo(() => {
    let list = upcoming.filter(e => matchesSearch(e, search));
    if (filter === "Tonight") list = list.filter(e => isTonight(e, clock));
    else if (filter === "This Week") list = list.filter(e => isThisWeek(e, clock));
    else if (vibeTerms[filter]) list = list.filter(e => matchesVibe(e, filter));
    else if (filter === "For You" && !search) list = [...list].sort((a, b) => relevance(b, userInterests) - relevance(a, userInterests) || chronological(a, b));
    return list;
  }, [upcoming, search, filter, clock, userInterests]);
  const shownPeople = useMemo(() => {
    let list = people.filter(p => matchesSearch(p, search));
    if (filter === "For You" && !search) list = list.filter(p => recommendedIds.includes(p.id));
    if (vibeTerms[filter]) list = list.filter(p => matchesVibe(p, filter));
    return [...list].sort((a, b) => (b.compatibility ?? -1) - (a.compatibility ?? -1));
  }, [people, recommendedIds, search, filter]);
  const shownClubs = useMemo(() => {
    let list = clubs.filter(club => matchesSearch(club, search));
    if (vibeTerms[filter]) list = list.filter(club => matchesVibe(club, filter));
    else if (filter === "For You" && !search) list = [...list].sort((a, b) => relevance(b, userInterests) - relevance(a, userInterests));
    return list;
  }, [clubs, search, filter, userInterests]);
  const shownRecs = useMemo(() => {
    let list = recs.filter(r => matchesSearch(r, search));
    if (vibeTerms[filter]) list = list.filter(r => matchesVibe(r, filter));
    else if (filter === "For You" && !search) list = [...list].sort((a, b) => relevance(b, userInterests) - relevance(a, userInterests));
    return list;
  }, [recs, search, filter, userInterests]);

  const matchReason = (person: any): string => person.reasons?.[0] ||
    (person.shared_interests?.length ? `You both like ${person.shared_interests.slice(0, 2).join(" and ")}` : "");

  const selectFilter = (value: string) => {
    setFilter(value);
    setVisibleCount(8);
  };

  const browseVibe = (vibe: string) => {
    setFilter(vibe);
    setQ("");
    setVisibleCount(8);
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
  const browseMode = ["Tonight", "This Week"].includes(filter) || !!vibeTerms[filter];

  const visible = visibleKinds(filter);
  const resultLists = [visible.events ? shownEvents : [], visible.people ? shownPeople : [],
    visible.clubs ? shownClubs : [], visible.recommendations ? shownRecs : []];
  const resultCount = resultLists.reduce((total, items) => total + items.length, 0);
  const hasMore = resultLists.some(items => items.length > visibleCount);

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.brandPrimary} />}>
        <Text style={styles.title}>Discover</Text>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput value={q} onChangeText={(value) => { setQ(value); setVisibleCount(8); }} returnKeyType="search" maxLength={80} placeholder="Search people, events, clubs, interests..." placeholderTextColor={colors.muted} style={styles.searchInput} />
          {!!q && <Pressable onPress={() => { setQ(""); setVisibleCount(8); }}><Icon name="close-circle" size={18} color={colors.muted} /></Pressable>}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((item) => <Pressable key={item} onPress={() => selectFilter(item)} style={[styles.filterChip, filter === item && styles.filterChipActive]}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text></Pressable>)}
        </ScrollView>

        {error ? <View style={styles.notice} accessibilityLiveRegion="polite">
          <Text style={styles.noticeText}>{error}</Text>
          <Pressable onPress={() => void load()} disabled={loading} style={styles.retryButton} accessibilityRole="button"><Text style={styles.seeAll}>{loading ? "Retrying..." : "Retry"}</Text></Pressable>
        </View> : null}
        {loading && <View style={styles.loadingRow}><ActivityIndicator color={colors.brandPrimary} /><Text style={styles.personMeta}>Updating Discover...</Text></View>}

        {!loaded ? null : isSearch || categoryOnly || browseMode ? (
          <View style={styles.results}>
            <Text style={styles.resultsTitle}>{isSearch ? `${filter === "For You" ? "Explore" : filter} · “${q}”` : filter}</Text>
            <Text style={styles.resultCount}>{resultCount} {resultCount === 1 ? "result" : "results"}{filter === "Tonight" ? " · From 5 PM, campus time" : filter === "This Week" ? " · Next 7 days, campus time" : ""}</Text>
            {visible.events && shownEvents.slice(0, visibleCount).map((e) => eventCard(e))}
            {visible.people && shownPeople.slice(0, visibleCount).map((p) => (
              <Pressable key={p.id} onPress={() => router.push(`/match/${p.id}`)} style={styles.personRow}>
                <Avatar uri={p.profile_photo_url} name={p.first_name} size={52} />
                <View style={styles.personBody}><Text style={styles.personName}>{p.first_name} {p.last_name}</Text><Text numberOfLines={1} style={styles.personMeta}>{(p.interests || []).slice(0, 3).join(" · ") || p.major || "Student"}</Text>{!!matchReason(p) && <Text numberOfLines={2} style={styles.matchReason}>{matchReason(p)}</Text>}</View>
                {typeof p.compatibility === "number" && <Text style={styles.match}>{p.compatibility}%</Text>}
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
            {visible.clubs && shownClubs.slice(0, visibleCount).map((c) => (
              <Pressable key={c.id} onPress={() => router.push(`/club/${c.id}`)} style={styles.clubRow}>
                {c.image_url ? <Image source={{ uri: c.image_url }} style={styles.clubIcon} contentFit="cover" /> : <View style={styles.clubIconFallback}><Icon name="people-outline" size={20} color={colors.brandPrimary} /></View>}
                <View style={styles.personBody}><Text style={styles.personName}>{c.name}</Text><Text numberOfLines={1} style={styles.personMeta}>{c.description || `${c.member_ids?.length || 0} members`}</Text></View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
            {visible.recommendations && shownRecs.slice(0, visibleCount).map((r) => (
              <Pressable key={r.id} onPress={() => router.push(`/recommendation/${r.id}`)} style={styles.clubRow}>
                <View style={styles.clubIconFallback}><Icon name="sparkles-outline" size={20} color={colors.brandPrimary} /></View>
                <View style={styles.personBody}><Text style={styles.personName}>{r.title}</Text><Text numberOfLines={1} style={styles.personMeta}>{r.description}</Text></View>
                <Icon name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            ))}
            {hasMore && <Pressable style={styles.moreButton} onPress={() => setVisibleCount(count => count + 8)} accessibilityRole="button"><Text style={styles.moreText}>Show more</Text><Icon name="chevron-down" size={16} color={colors.brandPrimary} /></Pressable>}
            {resultCount === 0 && !loading && !error && <View style={styles.emptyState}>
              <Icon name={filter === "People" ? "people-outline" : filter === "Clubs" ? "people-circle-outline" : "search-outline"} size={32} color={colors.brandPrimary} />
              <Text style={styles.emptyCardTitle}>{isSearch ? "No matches for this search" : filter === "Tonight" ? "No upcoming plans tonight" : filter === "This Week" ? "No events in the next 7 days" : `No ${filter.toLowerCase()} here yet`}</Text>
              <Text style={styles.emptyCardText}>{isSearch ? "Try a name, interest, location or another category." : "Try another category, or start something from Create."}</Text>
              <Pressable style={styles.moreButton} onPress={() => { setQ(""); selectFilter("For You"); }} accessibilityRole="button"><Text style={styles.moreText}>Explore everything</Text></Pressable>
            </View>}
          </View>
        ) : (
          <>
            <SectionHead title="Happening soon" action="Events" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalCards}>
              {upcoming.slice(0, 4).map((e) => eventCard(e, true))}
              {upcoming.length === 0 && !loading && !error && <View style={styles.emptyCard}><Icon name="calendar-outline" size={24} color={colors.brandPrimary} /><Text style={styles.emptyCardTitle}>Nothing scheduled yet</Text><Text style={styles.emptyCardText}>Check back as campus activity picks up.</Text></View>}
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
                  {!!matchReason(p) && <Text numberOfLines={3} style={[styles.matchReason, { textAlign: "center" }]}>{matchReason(p)}</Text>}
                </Pressable>
              ))}
            </ScrollView>

            {shownPeople.length === 0 && !error && <Text style={styles.personMeta}>No match suggestions yet. Browse People to see who's here.</Text>}
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
  notice: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, marginBottom: 12 },
  noticeText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 12, lineHeight: 18 },
  retryButton: { padding: 10 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  resultCount: { color: colors.muted, fontSize: 12, marginBottom: 16 },
  matchReason: { color: colors.brandPrimary, fontSize: 11, lineHeight: 16, marginTop: 6 },
  moreButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, marginVertical: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border },
  moreText: { color: colors.brandPrimary, fontSize: 13, fontWeight: "800" },
  emptyState: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 12 },
  results: { paddingTop: 8 },
  resultsTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "900", marginBottom: 12 },
  empty: { color: colors.muted, fontSize: 13, textAlign: "center", paddingVertical: 50 },
  emptyCard: { width: 275, height: 174, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, alignItems: "center", justifyContent: "center", padding: 20 },
  emptyCardTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "900", marginTop: 8 },
  emptyCardText: { color: colors.muted, fontSize: 11, textAlign: "center", marginTop: 4 },
}));
