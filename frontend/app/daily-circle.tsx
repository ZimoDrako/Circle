import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius } from "@/src/theme";
import { MainTabBar } from "@/src/components/main-tab-bar";
import { api } from "@/src/api";

const VIBES = [
  ["restaurant-outline", "Food"],
  ["cafe-outline", "Chill"],
  ["book-outline", "Study"],
  ["barbell-outline", "Active"],
  ["compass-outline", "Explore"],
  ["musical-notes-outline", "Party"],
  ["football-outline", "Sports"],
  ["ellipsis-horizontal", "Anything"],
] as const;
const TIMES = ["Right now", "Later today", "Tonight"];
const PEOPLE = ["Meet new people", "Friends", "Either"];

export default function DailyCircle() {
  const router = useRouter();
  const [vibe, setVibe] = useState("Food");
  const [time, setTime] = useState("Tonight");
  const [people, setPeople] = useState("Either");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const findCircle = async () => {
    setLoading(true); setError("");
    try {
      const r = await api.findDailyCircle({ vibe, time_preference: time, people_preference: people });
      setResult(r);
      if (r.circle?.id) router.replace(`/circle/${r.circle.id}`);
    } catch (e: any) { setError(e?.message || "Could not find your Circle"); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.root} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/(tabs)/home")} style={styles.back}><Icon name="chevron-back" size={24} color={colors.onSurface} /></Pressable>
        <Text style={styles.headerTitle}>Daily Circle</Text><View style={{ width: 42 }} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badge}><Icon name="sparkles" size={14} color={colors.brandPrimary} /><Text style={styles.badgeText}>PERSONALIZED FOR TODAY</Text></View>
        <Text style={styles.title}>What's the move?</Text>
        <Text style={styles.subtitle}>Pick your vibe. Circle finds students who are free and want to do the same thing.</Text>

        <Text style={styles.label}>What are you up for?</Text>
        <View style={styles.grid}>{VIBES.map(([icon,label]) => (
          <Pressable key={label} onPress={() => setVibe(label)} style={[styles.vibe, vibe === label && styles.selected]}>
            <Icon name={icon} size={22} color={vibe === label ? colors.brandPrimary : colors.onSurface} />
            <Text style={[styles.vibeLabel, vibe === label && styles.selectedText]}>{label}</Text>
          </Pressable>
        ))}</View>

        <Text style={styles.label}>When?</Text>
        <View style={styles.row}>{TIMES.map(x => <Pressable key={x} onPress={() => setTime(x)} style={[styles.pill, time === x && styles.selected]}><Text style={[styles.pillText,time === x && styles.selectedText]}>{x}</Text></Pressable>)}</View>

        <Text style={styles.label}>Who do you want to meet?</Text>
        <View style={styles.row}>{PEOPLE.map(x => <Pressable key={x} onPress={() => setPeople(x)} style={[styles.pill, people === x && styles.selected]}><Text style={[styles.pillText,people === x && styles.selectedText]}>{x}</Text></Pressable>)}</View>

        <View style={styles.preview}>
          <View style={styles.previewIcon}><Icon name="people" size={22} color={colors.onBrandPrimary} /></View>
          <View style={{ flex: 1 }}><Text style={styles.previewTitle}>Your next Circle</Text><Text style={styles.previewText}>{vibe} · {time} · {people}</Text></View>
        </View>
        <Pressable style={[styles.cta, loading && { opacity: .6 }]} disabled={loading} onPress={findCircle}>
          <Text style={styles.ctaText}>{loading ? "Finding your people..." : "Find my Circle"}</Text><Icon name="arrow-forward" size={18} color={colors.onBrandPrimary} />
        </Pressable>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {result?.status === "waiting" ? <View style={styles.waiting}><Icon name="time-outline" size={20} color={colors.brandPrimary}/><View style={{flex:1}}><Text style={styles.waitingTitle}>Your Circle is forming</Text><Text style={styles.waitingText}>We saved your plan. When compatible students choose the same move today, Circle can put you together.</Text></View></View> : null}
      </ScrollView>
      <MainTabBar />
    </SafeAreaView>
  );
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:colors.surface},header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:spacing.lg,paddingVertical:spacing.md,borderBottomWidth:1,borderBottomColor:colors.divider},back:{width:42,height:42,alignItems:"center",justifyContent:"center"},headerTitle:{fontSize:17,fontWeight:"700",color:colors.onSurface},content:{padding:spacing.xl,paddingBottom:120},badge:{alignSelf:"flex-start",flexDirection:"row",alignItems:"center",gap:6,backgroundColor:colors.brandTertiary,paddingHorizontal:10,paddingVertical:6,borderRadius:radius.pill},badgeText:{color:colors.onBrandTertiary,fontSize:10,fontWeight:"800",letterSpacing:.8},title:{fontSize:32,fontWeight:"800",color:colors.onSurface,marginTop:spacing.lg},subtitle:{fontSize:15,lineHeight:22,color:colors.muted,marginTop:spacing.sm,maxWidth:500},label:{fontSize:15,fontWeight:"800",color:colors.onSurface,marginTop:spacing.xl,marginBottom:spacing.md},grid:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},vibe:{width:"23%",minWidth:82,alignItems:"center",gap:7,paddingVertical:spacing.md,borderRadius:radius.md,backgroundColor:colors.surfaceSecondary,borderWidth:1,borderColor:colors.border},vibeLabel:{fontSize:12,fontWeight:"700",color:colors.onSurface},selected:{backgroundColor:colors.brandTertiary,borderColor:colors.brandPrimary},selectedText:{color:colors.onBrandTertiary},row:{flexDirection:"row",flexWrap:"wrap",gap:spacing.sm},pill:{paddingHorizontal:14,paddingVertical:10,borderRadius:radius.pill,backgroundColor:colors.surfaceSecondary,borderWidth:1,borderColor:colors.border},pillText:{fontSize:13,fontWeight:"600",color:colors.onSurfaceSecondary},preview:{flexDirection:"row",alignItems:"center",gap:spacing.md,marginTop:spacing.xxl,padding:spacing.lg,borderRadius:radius.lg,backgroundColor:colors.surfaceSecondary},previewIcon:{width:44,height:44,borderRadius:22,backgroundColor:colors.brandPrimary,alignItems:"center",justifyContent:"center"},previewTitle:{fontSize:15,fontWeight:"800",color:colors.onSurface},previewText:{fontSize:12,color:colors.muted,marginTop:3},cta:{marginTop:spacing.md,backgroundColor:colors.brandPrimary,minHeight:52,borderRadius:radius.pill,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:spacing.sm},ctaText:{color:colors.onBrandPrimary,fontSize:16,fontWeight:"800"},demoNote:{textAlign:"center",color:colors.muted,fontSize:11,marginTop:spacing.sm},error:{color:colors.error,fontSize:12,textAlign:"center",marginTop:spacing.md},waiting:{flexDirection:"row",gap:spacing.md,alignItems:"flex-start",marginTop:spacing.lg,padding:spacing.lg,borderRadius:radius.lg,backgroundColor:colors.brandTertiary},waitingTitle:{fontSize:14,fontWeight:"800",color:colors.onBrandTertiary},waitingText:{fontSize:12,lineHeight:18,color:colors.onBrandTertiary,marginTop:3}
});