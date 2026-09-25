import { useState } from "react";
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { api } from "@/src/api";
import { colors, spacing, radius } from "@/src/theme";

const intents = [
  ["post", "Just share", "chatbubble-outline"],
  ["anyone_down", "Anyone down?", "people-outline"],
  ["looking_for_people", "Looking for people", "search-outline"],
  ["question", "Question", "help-circle-outline"],
  ["recommendation", "Recommendation", "bulb-outline"],
] as const;

export default function CreatePost() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [intent, setIntent] = useState("post");
  const [audience, setAudience] = useState<"campus" | "connections">("campus");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const text = content.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      await api.createPost({ content: text, intent, audience });
      router.back();
    } catch (e: any) {
      Alert.alert("Couldn't post", e?.message || "Try again.");
    } finally {
      setBusy(false);
    }
  };

  return <SafeAreaView style={styles.page}>
    <View style={styles.header}>
      <Pressable onPress={() => router.back()}><Icon name="close" size={26} color={colors.onSurface} /></Pressable>
      <Text style={styles.title}>Create post</Text>
      <Pressable onPress={submit} disabled={!content.trim() || busy} style={[styles.postBtn, (!content.trim() || busy) && { opacity: .45 }]}><Text style={styles.postBtnText}>{busy ? "Posting..." : "Post"}</Text></Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TextInput value={content} onChangeText={setContent} multiline autoFocus maxLength={1000} placeholder="What's happening? Find people, make a plan, ask something..." placeholderTextColor={colors.muted} style={styles.input} />
      <Text style={styles.count}>{content.length}/1000</Text>
      <Text style={styles.label}>What's the vibe?</Text>
      <View style={styles.wrap}>{intents.map(([key,label,icon]) => <Pressable key={key} onPress={() => setIntent(key)} style={[styles.intent, intent === key && styles.intentOn]}><Icon name={icon as any} size={16} color={intent === key ? colors.onBrandPrimary : colors.brandPrimary} /><Text style={[styles.intentText, intent === key && styles.intentTextOn]}>{label}</Text></Pressable>)}</View>
      <Text style={styles.label}>Who can see it?</Text>
      <View style={styles.audienceRow}>
        <Pressable onPress={() => setAudience("campus")} style={[styles.audience, audience === "campus" && styles.audienceOn]}><Icon name="school-outline" size={18} color={audience === "campus" ? colors.onBrandPrimary : colors.brandPrimary} /><Text style={[styles.intentText, audience === "campus" && styles.intentTextOn]}>Campus</Text></Pressable>
        <Pressable onPress={() => setAudience("connections")} style={[styles.audience, audience === "connections" && styles.audienceOn]}><Icon name="people-outline" size={18} color={audience === "connections" ? colors.onBrandPrimary : colors.brandPrimary} /><Text style={[styles.intentText, audience === "connections" && styles.intentTextOn]}>Connections</Text></Pressable>
      </View>
      <View style={styles.note}><Icon name="sparkles" size={18} color={colors.brandPrimary} /><Text style={styles.noteText}>Posts on Circle are meant to start conversations and real plans — not chase likes.</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  page:{flex:1,backgroundColor:colors.surface}, header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",padding:spacing.lg,borderBottomWidth:1,borderBottomColor:colors.divider},title:{fontSize:17,fontWeight:"900",color:colors.onSurface},postBtn:{backgroundColor:colors.brandPrimary,borderRadius:radius.pill,paddingHorizontal:16,paddingVertical:9},postBtnText:{color:colors.onBrandPrimary,fontWeight:"800"},content:{padding:spacing.xl},input:{minHeight:150,color:colors.onSurface,fontSize:19,lineHeight:27,textAlignVertical:"top"},count:{textAlign:"right",fontSize:11,color:colors.muted},label:{fontSize:13,fontWeight:"800",color:colors.onSurface,marginTop:spacing.xl,marginBottom:spacing.sm},wrap:{flexDirection:"row",flexWrap:"wrap",gap:8},intent:{flexDirection:"row",alignItems:"center",gap:6,paddingHorizontal:12,paddingVertical:9,borderRadius:radius.pill,borderWidth:1,borderColor:colors.border},intentOn:{backgroundColor:colors.brandPrimary,borderColor:colors.brandPrimary},intentText:{fontSize:12,fontWeight:"700",color:colors.onSurface},intentTextOn:{color:colors.onBrandPrimary},audienceRow:{flexDirection:"row",gap:10},audience:{flex:1,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7,padding:12,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg},audienceOn:{backgroundColor:colors.brandPrimary,borderColor:colors.brandPrimary},note:{flexDirection:"row",gap:9,marginTop:spacing.xl,padding:spacing.md,backgroundColor:colors.brandTertiary,borderRadius:radius.lg},noteText:{flex:1,color:colors.onSurface,fontSize:12,lineHeight:17}
});
