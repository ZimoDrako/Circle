import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, KeyboardAvoidingView, Platform, FlatList, Modal } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius } from "@/src/theme";
import { Avatar } from "@/src/ui";
import { api } from "@/src/api";
import { MainTabBar } from "@/src/components/main-tab-bar";
import { useAuth } from "@/src/auth";

export default function CircleChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [circle, setCircle] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [membersOpen, setMembersOpen] = useState(false);
  const [keepBusy, setKeepBusy] = useState(false);
  const listRef = useRef<FlatList>(null);

  const loadCircle = useCallback(async () => {
    try {
      const r = await api.getCircle(id!);
      setCircle(r.circle);
    } catch {}
  }, [id]);

  const loadMessages = useCallback(async () => {
    try {
      const r = await api.getMessages(id!);
      setMessages(r.messages || []);
    } catch {}
  }, [id]);

  useFocusEffect(useCallback(() => {
    loadCircle();
    loadMessages();
  }, [loadCircle, loadMessages]));

  useEffect(() => {
    const t = setInterval(loadMessages, 4000);
    return () => clearInterval(t);
  }, [loadMessages]);

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    try {
      const r = await api.sendMessage(id!, text);
      setMessages((m) => [...m, r.message]);
    } catch {}
  };

  const join = async () => {
    await api.joinCircle(id!);
    loadCircle();
    loadMessages();
  };

  const voteKeep = async () => {
    if (keepBusy) return;
    setKeepBusy(true);
    try {
      const r = await api.keepDailyCircle(id!);
      setCircle(r.circle);
      if (r.kept) loadMessages();
    } finally {
      setKeepBusy(false);
    }
  };

  if (!circle) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}><Text style={{ padding: 24, color: colors.muted }}>Loading...</Text></SafeAreaView>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.replace("/(tabs)/circles")} testID="circle-back"><Icon name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={styles.title} numberOfLines={1}>{circle.name}</Text>
              {circle.verified_only && <Icon name="shield-checkmark" size={14} color={colors.brandPrimary} />}
            </View>
            <Text style={styles.meta}>
              {circle.type === "dm"
                ? `${circle.other_user?.major || "CSUF"} · 1:1 chat`
                : circle.verified_only
                  ? `${circle.member_ids.length} verified Titans · private`
                  : `${circle.member_ids.length} members`}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="View Circle members"
            testID="circle-members-button"
            disabled={circle.type === "dm"}
            hitSlop={10}
            onPress={() => circle.type !== "dm" && setMembersOpen(true)}
            style={styles.avatarStack}
          >
            {(circle.type === "dm" ? circle.members.filter((m: any) => m.id !== user?.id) : circle.members.slice(0, 3)).map((m: any, i: number) => (
              <View key={m.id} pointerEvents="none" style={{ marginLeft: i === 0 ? 0 : -10, borderWidth: 2, borderColor: colors.surface, borderRadius: 999 }}>
                <Avatar uri={m.profile_photo_url} name={m.first_name} size={28} />
              </View>
            ))}
            {circle.type !== "dm" && circle.members.length > 3 && (
              <View pointerEvents="none" style={styles.moreMembers}><Text style={styles.moreMembersText}>+{circle.members.length - 3}</Text></View>
            )}
          </Pressable>
        </View>
      </SafeAreaView>

      {circle.event && (
        <View style={styles.eventPill}>
          <Icon name="calendar" size={14} color={colors.brandPrimary} />
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.eventTitle} numberOfLines={1}>{circle.event.title}</Text>
            <Text style={styles.eventMeta}>{circle.event.date} · {circle.event.time} · {circle.event.location}</Text>
          </View>
          <Pressable onPress={() => router.push(`/event/${circle.event.id}`)}>
            <Text style={styles.eventLink}>View</Text>
          </Pressable>
        </View>
      )}

      {circle.type === "daily" && circle.daily_status !== "expired" && (
        <View style={styles.keepCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.keepTitle}>{circle.daily_status === "kept" ? "Circle kept" : "Keep this Circle?"}</Text>
            <Text style={styles.keepMeta}>
              {circle.daily_status === "kept"
                ? "At least 3 members voted yes. This group is permanent."
                : `${(circle.keep_vote_ids || []).length}/3 members voted yes`}
            </Text>
          </View>
          {circle.daily_status !== "kept" && (
            <Pressable
              onPress={voteKeep}
              disabled={keepBusy || (circle.keep_vote_ids || []).includes(user?.id)}
              style={[styles.keepBtn, (circle.keep_vote_ids || []).includes(user?.id) && styles.keepBtnDone]}
              testID="circle-keep-vote"
            >
              <Text style={styles.keepBtnText}>
                {(circle.keep_vote_ids || []).includes(user?.id) ? "Voted" : keepBusy ? "Saving..." : "Yes, keep it"}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
            <Icon name={circle.is_member ? "chatbubbles-outline" : "lock-closed-outline"} size={40} color={colors.muted} />
            <Text style={{ color: colors.muted, marginTop: 12 }}>{circle.is_member ? "Say hi to your new Circle" : "Join this Circle to see the conversation"}</Text>
          </View>
        }
        renderItem={({ item: m }) => {
          if (m.system) {
            return <Text style={styles.systemMsg}>{m.content}</Text>;
          }
          const mine = m.sender_id === user?.id;
          return (
            <View style={[styles.msgRow, mine ? { justifyContent: "flex-end" } : {}]}>
              {!mine && <Avatar uri={m.sender?.profile_photo_url} name={m.sender?.first_name} size={28} />}
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                {!mine && <Text style={styles.bubbleSender}>{m.sender?.first_name}</Text>}
                <Text style={[styles.bubbleText, mine && { color: colors.onBrandPrimary }]}>{m.content}</Text>
              </View>
            </View>
          );
        }}
      />

      {circle.is_member ? (
        <SafeAreaView edges={["bottom"]} style={styles.inputWrap}>
          <View style={styles.inputRow}>
            <TextInput
              testID="circle-input"
              value={input}
              onChangeText={setInput}
              placeholder="Message..."
              placeholderTextColor={colors.muted}
              style={styles.input}
              onSubmitEditing={send}
            />
            <Pressable onPress={send} style={styles.sendBtn} testID="circle-send">
              <Icon name="arrow-up" size={18} color={colors.onBrandPrimary} />
            </Pressable>
          </View>
        </SafeAreaView>
      ) : circle.type === "dm" ? null : (
        <SafeAreaView edges={["bottom"]} style={styles.inputWrap}>
          <Pressable onPress={join} style={styles.joinBtn} testID="circle-join">
            <Text style={styles.joinText}>Join this Circle</Text>
          </Pressable>
        </SafeAreaView>
      )}
      <Modal visible={membersOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setMembersOpen(false)}>
        <SafeAreaView style={styles.membersPage}>
          <View style={styles.membersHeader}>
            <Pressable onPress={() => setMembersOpen(false)} style={styles.membersClose} testID="circle-members-close">
              <Icon name="close" size={22} color={colors.onSurface} />
            </Pressable>
            <Text style={styles.membersTitle}>Circle members</Text>
          </View>
          <FlatList
            data={circle.members || []}
            keyExtractor={(m: any) => m.id}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
            renderItem={({ item: m }: any) => (
              <Pressable
                style={styles.memberRow}
                onPress={() => {
                  setMembersOpen(false);
                  router.push(m.id === user?.id ? "/(tabs)/profile" : `/match/${m.id}`);
                }}
              >
                <Avatar uri={m.profile_photo_url} name={m.first_name} size={46} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{m.first_name}{m.id === user?.id ? " (You)" : ""}</Text>
                  <Text style={styles.memberMeta}>{[m.major, m.year].filter(Boolean).join(" · ") || "Circle member"}</Text>
                </View>
                <Icon name="chevron-forward" size={20} color={colors.muted} />
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
      <MainTabBar />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surface },
  title: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  meta: { color: colors.muted, fontSize: 12 },
  avatarStack: { flexDirection: "row", alignItems: "center", paddingVertical: 4, paddingLeft: 4 },
  moreMembers: { width: 28, height: 28, borderRadius: 14, marginLeft: -8, backgroundColor: colors.surfaceSecondary, borderWidth: 2, borderColor: colors.surface, alignItems: "center", justifyContent: "center" },
  moreMembersText: { color: colors.onSurface, fontSize: 10, fontWeight: "800" },
  eventPill: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.brandTertiary, marginHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: radius.md },
  eventTitle: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: 13 },
  eventMeta: { color: colors.onBrandTertiary, fontSize: 11, marginTop: 2 },
  eventLink: { color: colors.brandPrimary, fontWeight: "700", fontSize: 12 },
  keepCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginHorizontal: spacing.md, marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  keepTitle: { color: colors.onSurface, fontSize: 14, fontWeight: "800" },
  keepMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  keepBtn: { backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 10 },
  keepBtnDone: { opacity: 0.55 },
  keepBtnText: { color: colors.onBrandPrimary, fontSize: 12, fontWeight: "800" },
  systemMsg: { color: colors.muted, fontSize: 12, textAlign: "center", marginVertical: 6 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  bubble: { maxWidth: "78%", padding: 10, borderRadius: 16 },
  bubbleMine: { backgroundColor: colors.brandPrimary, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: colors.surfaceSecondary, borderBottomLeftRadius: 4 },
  bubbleSender: { color: colors.brandPrimary, fontWeight: "700", fontSize: 11, marginBottom: 2 },
  bubbleText: { color: colors.onSurface, fontSize: 14 },
  inputWrap: { backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.divider },
  inputRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.sm },
  input: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: 12, fontSize: 14, color: colors.onSurface, borderWidth: 1, borderColor: colors.border },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  joinBtn: { margin: spacing.md, padding: spacing.md, backgroundColor: colors.brandPrimary, borderRadius: radius.pill, alignItems: "center" },
  joinText: { color: colors.onBrandPrimary, fontWeight: "700" },
  membersPage: { flex: 1, backgroundColor: colors.surface },
  membersHeader: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.divider },
  membersClose: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  membersTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  memberRow: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  memberName: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  memberMeta: { color: colors.muted, fontSize: 13, marginTop: 2 },
});
