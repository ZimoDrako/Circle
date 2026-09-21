import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform, FlatList } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius } from "@/src/theme";
import { Avatar } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

export default function CircleChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [circle, setCircle] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState("");
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

  if (!circle) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}><Text style={{ padding: 24, color: colors.muted }}>Loading...</Text></SafeAreaView>;

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.surface }}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="circle-back"><Icon name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
          <View style={{ flex: 1, marginLeft: spacing.sm }}>
            <Text style={styles.title} numberOfLines={1}>{circle.name}</Text>
            <Text style={styles.meta}>{circle.member_ids.length} members</Text>
          </View>
          <View style={styles.avatarStack}>
            {circle.members.slice(0, 3).map((m: any, i: number) => (
              <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -10, borderWidth: 2, borderColor: colors.surface, borderRadius: 999 }}>
                <Avatar uri={m.profile_photo_url} name={m.first_name} size={28} />
              </View>
            ))}
          </View>
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

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80 }}>
            <Icon name="chatbubbles-outline" size={40} color={colors.muted} />
            <Text style={{ color: colors.muted, marginTop: 12 }}>Say hi to your new Circle</Text>
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
      ) : (
        <SafeAreaView edges={["bottom"]} style={styles.inputWrap}>
          <Pressable onPress={join} style={styles.joinBtn} testID="circle-join">
            <Text style={styles.joinText}>Join this Circle</Text>
          </Pressable>
        </SafeAreaView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: colors.surface },
  title: { fontSize: 16, fontWeight: "700", color: colors.onSurface },
  meta: { color: colors.muted, fontSize: 12 },
  avatarStack: { flexDirection: "row" },
  eventPill: { flexDirection: "row", alignItems: "center", padding: spacing.md, backgroundColor: colors.brandTertiary, marginHorizontal: spacing.md, marginTop: spacing.sm, borderRadius: radius.md },
  eventTitle: { color: colors.onBrandTertiary, fontWeight: "700", fontSize: 13 },
  eventMeta: { color: colors.onBrandTertiary, fontSize: 11, marginTop: 2 },
  eventLink: { color: colors.brandPrimary, fontWeight: "700", fontSize: 12 },
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
});
