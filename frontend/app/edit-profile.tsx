import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import * as ImagePicker from "expo-image-picker";
import { colors, spacing, radius, useTheme, makeStyles } from "@/src/theme";
import { Avatar } from "@/src/ui";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";

const YEARS = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];
const LOOKING = ["New friends", "People to attend events with", "Networking", "Exploring campus", "Dating"];

export default function EditProfile() {
  const { colors: themeColors } = useTheme();
  const styles = useStyles();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [bio, setBio] = useState(user?.bio || "");
  const [major, setMajor] = useState(user?.major || "");
  const [year, setYear] = useState(user?.year || "");
  const [interests, setInterests] = useState<string[]>(user?.interests || []);
  const [lookingFor, setLookingFor] = useState<string[]>(user?.looking_for || []);
  const [profilePhoto, setProfilePhoto] = useState(user?.profile_photo_url || "");
  const [banner, setBanner] = useState(user?.banner_image_url || "");
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const upload = async (kind: "photo" | "banner") => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: .78, allowsEditing: true, ...(kind === "banner" ? { aspect: [16, 7] as [number, number] } : { aspect: [1, 1] as [number, number] }) });
    if (!res.canceled && res.assets[0]) {
      try {
        const up = await api.uploadImage(res.assets[0].uri);
        if (kind === "banner") setBanner(up.url); else setProfilePhoto(up.url);
      } catch { Alert.alert("Upload failed", "Please try again."); }
    }
  };

  const toggleLooking = (item: string) => setLookingFor(v => v.includes(item) ? v.filter(x => x !== item) : [...v, item]);
  const removeInterest = (item: string) => setInterests(v => v.filter(x => x !== item));

  const save = async () => {
    setSaving(true);
    try {
      await api.updateProfile({ bio: bio.trim(), major: major.trim(), year, interests, looking_for: lookingFor, profile_photo_url: profilePhoto || null, banner_image_url: banner || null });
      await refresh();
      router.back();
    } catch (e: any) { Alert.alert("Couldn't save profile", e?.message || "Please try again."); }
    finally { setSaving(false); }
  };

  return <View style={styles.root}>
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}><Icon name="chevron-back" size={24} color={themeColors.onSurface} /></Pressable>
        <Text style={styles.title}>Edit profile</Text>
        <Pressable onPress={save} disabled={saving}><Text style={styles.save}>{saving ? "Saving…" : "Save"}</Text></Pressable>
      </View>
    </SafeAreaView>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable style={styles.banner} onPress={() => upload("banner")}>
        {banner ? <Image source={{ uri: banner }} style={styles.bannerImage} /> : <View style={styles.bannerEmpty}><Icon name="image-outline" size={28} color={themeColors.brandPrimary} /><Text style={styles.muted}>Add banner</Text></View>}
        <View style={styles.change}><Icon name="camera" size={14} color="#fff" /><Text style={styles.changeText}>Change</Text></View>
      </Pressable>
      <Pressable style={styles.avatar} onPress={() => upload("photo")}><Avatar uri={profilePhoto || null} name={user.first_name} size={96} /><View style={styles.camera}><Icon name="camera" size={15} color="#fff" /></View></Pressable>

      <Text style={styles.label}>About me</Text>
      <TextInput style={[styles.input, styles.bio]} value={bio} onChangeText={setBio} multiline maxLength={500} placeholder="Tell people a little about yourself…" placeholderTextColor={themeColors.muted} />
      <Text style={styles.count}>{bio.length}/500</Text>

      <Text style={styles.label}>Major</Text>
      <TextInput style={styles.input} value={major} onChangeText={setMajor} maxLength={120} placeholder="Your major" placeholderTextColor={themeColors.muted} />

      <Text style={styles.label}>Year</Text>
      <View style={styles.wrap}>{YEARS.map(x => <Pressable key={x} onPress={() => setYear(x)} style={[styles.pill, year === x && styles.pillOn]}><Text style={[styles.pillText, year === x && styles.pillTextOn]}>{x}</Text></Pressable>)}</View>

      <View style={styles.sectionHead}><Text style={styles.label}>Interests</Text><Text style={styles.muted}>{interests.length} selected</Text></View>
      <Text style={styles.helper}>Tap an interest to remove it. You can choose more during onboarding for now.</Text>
      <View style={styles.wrap}>{interests.map(x => <Pressable key={x} onPress={() => removeInterest(x)} style={styles.interest}><Text style={styles.interestText}>{x}</Text><Icon name="close" size={14} color={themeColors.muted} /></Pressable>)}</View>

      <Text style={styles.label}>Looking for</Text>
      <View style={styles.wrap}>{LOOKING.map((x, i) => { const on=lookingFor.includes(x); return <Pressable key={x} onPress={() => toggleLooking(x)} style={[styles.look, styles["look"+i as keyof typeof styles] as any, on && styles.lookOn]}><Text style={[styles.lookText, on && styles.lookTextOn]}>{x}</Text></Pressable>; })}</View>
      <View style={{height:40}} />
    </ScrollView>
  </View>;
}

const useStyles = makeStyles((colors) => ({
  root:{flex:1,backgroundColor:colors.surface}, safe:{backgroundColor:colors.surface}, header:{height:58,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:spacing.md,borderBottomWidth:1,borderBottomColor:colors.divider}, headerButton:{width:42,height:42,alignItems:"center",justifyContent:"center"}, title:{fontSize:19,fontWeight:"900",color:colors.onSurface}, save:{fontSize:16,fontWeight:"900",color:colors.brandPrimary,paddingHorizontal:8},
  content:{paddingBottom:40}, banner:{height:170,backgroundColor:colors.brandTertiary}, bannerImage:{width:"100%",height:"100%"}, bannerEmpty:{flex:1,alignItems:"center",justifyContent:"center",gap:6}, change:{position:"absolute",right:16,top:14,backgroundColor:"rgba(0,0,0,.55)",borderRadius:20,paddingHorizontal:11,paddingVertical:7,flexDirection:"row",gap:5,alignItems:"center"}, changeText:{color:"#fff",fontSize:12,fontWeight:"800"},
  avatar:{alignSelf:"flex-start",marginLeft:24,marginTop:-45,borderWidth:4,borderColor:colors.surface,borderRadius:56}, camera:{position:"absolute",right:-2,bottom:2,width:30,height:30,borderRadius:15,backgroundColor:colors.brandPrimary,alignItems:"center",justifyContent:"center",borderWidth:2,borderColor:"#fff"},
  label:{fontSize:16,fontWeight:"900",color:colors.onSurface,marginTop:24,marginBottom:9,marginHorizontal:24}, input:{marginHorizontal:24,borderWidth:1,borderColor:colors.divider,borderRadius:radius.lg,paddingHorizontal:15,paddingVertical:13,fontSize:16,color:colors.onSurface,backgroundColor:colors.surfaceSecondary}, bio:{minHeight:105,textAlignVertical:"top"}, count:{marginHorizontal:24,marginTop:5,textAlign:"right",fontSize:11,color:colors.muted}, muted:{fontSize:12,color:colors.muted}, helper:{fontSize:12,color:colors.muted,marginHorizontal:24,marginTop:-4,marginBottom:10}, sectionHead:{flexDirection:"row",alignItems:"flex-end",justifyContent:"space-between",paddingRight:24}, wrap:{flexDirection:"row",flexWrap:"wrap",gap:8,marginHorizontal:24},
  pill:{paddingHorizontal:14,paddingVertical:9,borderRadius:20,backgroundColor:colors.surfaceSecondary,borderWidth:1,borderColor:colors.divider}, pillOn:{backgroundColor:colors.brandPrimary,borderColor:colors.brandPrimary}, pillText:{fontSize:13,fontWeight:"700",color:colors.onSurface}, pillTextOn:{color:colors.onBrandPrimary},
  interest:{flexDirection:"row",alignItems:"center",gap:5,paddingHorizontal:12,paddingVertical:8,borderRadius:18,backgroundColor:colors.brandTertiary}, interestText:{fontSize:12,fontWeight:"700",color:colors.onBrandTertiary},
  look:{paddingHorizontal:13,paddingVertical:9,borderRadius:20,backgroundColor:"#EEF5FF"}, look0:{backgroundColor:"#EAF3FF"}, look1:{backgroundColor:"#F1EBFF"}, look2:{backgroundColor:"#FFECEF"}, look3:{backgroundColor:"#E9F8F0"}, look4:{backgroundColor:"#FFECEF"}, lookOn:{borderWidth:1.5,borderColor:colors.brandPrimary}, lookText:{fontSize:12,fontWeight:"700",color:colors.onSurface}, lookTextOn:{color:colors.brandPrimary}
}));
