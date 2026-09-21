import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius } from "@/src/theme";
import { Avatar, Button, CompatibilityBadge } from "@/src/ui";
import { api } from "@/src/api";

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<any>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creatingCircle, setCreatingCircle] = useState(false);

  const load = useCallback(async () => {
    try {
      const [e, a] = await Promise.all([api.getEvent(id!), api.eventAttendees(id!)]);
      setEvent(e.event);
      setAttendees(a.attendees || []);
    } catch {}
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const rsvp = async (status: "going" | "interested" | "none") => {
    if (!event) return;
    await api.rsvp(event.id, status);
    load();
  };

  const createCircle = async () => {
    if (!event || selected.size === 0) return;
    setCreatingCircle(true);
    try {
      const r = await api.createCircle({
        name: `${event.title} group`,
        interests: event.tags || [],
        member_ids: [...selected],
        event_id: event.id,
      });
      router.push(`/circle/${r.circle.id}`);
    } finally {
      setCreatingCircle(false);
    }
  };

  if (!event) return <SafeAreaView style={styles.root}><Text style={{ padding: 24, color: colors.muted }}>Loading...</Text></SafeAreaView>;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ paddingBottom: 200 }}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: event.cover_image_url }} style={styles.hero} contentFit="cover" />
          <LinearGradient colors={["rgba(0,0,0,0.4)", "transparent", "rgba(9,9,11,0.9)"]} style={StyleSheet.absoluteFill} />
          <SafeAreaView edges={["top"]} style={styles.heroTop}>
            <Pressable onPress={() => router.back()} style={styles.back} testID="event-back">
              <Icon name="chevron-back" size={22} color="#FFF" />
            </Pressable>
          </SafeAreaView>
          <View style={styles.heroBody}>
            <Text style={styles.heroCat}>{event.category.toUpperCase()}</Text>
            <Text style={styles.heroTitle}>{event.title}</Text>
            <View style={styles.heroMetaRow}>
              <Icon name="calendar-outline" size={14} color="#FFF" />
              <Text style={styles.heroMeta}>{event.date} · {event.time}</Text>
            </View>
            <View style={styles.heroMetaRow}>
              <Icon name="location-outline" size={14} color="#FFF" />
              <Text style={styles.heroMeta}>{event.location}</Text>
            </View>
          </View>
        </View>

        <View style={styles.body}>
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statNum}>{event.going_count || 0}</Text>
              <Text style={styles.statLabel}>Going</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statNum}>{event.interested_count || 0}</Text>
              <Text style={styles.statLabel}>Interested</Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statNum}>{attendees.filter(a => a.compatibility >= 70).length}</Text>
              <Text style={styles.statLabel}>Good matches</Text>
            </View>
          </View>

          <View style={styles.rsvpRow}>
            <Button
              label="Going"
              variant={event.my_status === "going" ? "primary" : "secondary"}
              onPress={() => rsvp(event.my_status === "going" ? "none" : "going")}
              style={{ flex: 1 }}
              testID="event-going"
            />
            <View style={{ width: spacing.sm }} />
            <Button
              label="Interested"
              variant={event.my_status === "interested" ? "primary" : "secondary"}
              onPress={() => rsvp(event.my_status === "interested" ? "none" : "interested")}
              style={{ flex: 1 }}
              testID="event-interested"
            />
          </View>

          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.desc}>{event.description}</Text>

          <Text style={styles.sectionTitle}>Find people to go with</Text>
          <Text style={styles.sub}>Sorted by compatibility. Tap to select, then create an Event Circle.</Text>

          <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
            {attendees.slice(0, 12).map((a) => {
              const isSel = selected.has(a.user.id);
              return (
                <Pressable
                  key={a.user.id}
                  testID={`attendee-${a.user.id}`}
                  onPress={() =>
                    setSelected((s) => {
                      const n = new Set(s);
                      if (n.has(a.user.id)) n.delete(a.user.id);
                      else n.add(a.user.id);
                      return n;
                    })
                  }
                  style={[styles.attRow, isSel && { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary }]}
                >
                  <Avatar uri={a.user.profile_photo_url} name={a.user.first_name} size={48} />
                  <View style={{ flex: 1, marginLeft: spacing.md }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                      <Text style={styles.attName}>{a.user.first_name}</Text>
                      <CompatibilityBadge score={a.compatibility} />
                    </View>
                    <Text numberOfLines={1} style={styles.attMeta}>{(a.shared_interests || []).slice(0, 3).join(" · ") || a.user.major}</Text>
                    <Text style={styles.attStatus}>{a.status === "going" ? "Going" : "Interested"}</Text>
                  </View>
                  <View style={[styles.check, isSel && { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary }]}>
                    {isSel && <Icon name="checkmark" size={16} color={colors.onBrandPrimary} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={styles.footer}>
        <Button
          testID="event-create-circle"
          label={selected.size ? `Create Event Circle (${selected.size})` : "Find People to Go With"}
          onPress={createCircle}
          loading={creatingCircle}
          disabled={selected.size === 0}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  heroWrap: { height: 320, backgroundColor: colors.surfaceTertiary },
  hero: { ...StyleSheet.absoluteFillObject },
  heroTop: { paddingHorizontal: spacing.lg },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center", marginTop: spacing.sm },
  heroBody: { position: "absolute", left: spacing.xl, right: spacing.xl, bottom: spacing.xl },
  heroCat: { color: colors.brandSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
  heroTitle: { color: "#FFF", fontSize: 26, fontWeight: "800", marginTop: 4, lineHeight: 30 },
  heroMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  heroMeta: { color: "rgba(255,255,255,0.9)", fontSize: 13 },
  body: { padding: spacing.xl },
  statsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.lg },
  statBlock: { flex: 1, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, alignItems: "center" },
  statNum: { fontSize: 20, fontWeight: "800", color: colors.brandPrimary },
  statLabel: { fontSize: 11, color: colors.muted, marginTop: 2 },
  rsvpRow: { flexDirection: "row" },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: colors.onSurface, marginTop: spacing.xl },
  sub: { color: colors.muted, marginTop: 4, fontSize: 13 },
  desc: { color: colors.onSurfaceSecondary, marginTop: spacing.sm, fontSize: 14, lineHeight: 21 },
  attRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  attName: { color: colors.onSurface, fontWeight: "700", fontSize: 15 },
  attMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  attStatus: { color: colors.brandPrimary, fontSize: 11, fontWeight: "600", marginTop: 2 },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.xl, paddingTop: spacing.md, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
});
