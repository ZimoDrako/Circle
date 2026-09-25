import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Icon from "@react-native-vector-icons/ionicons";
import { accentOptions, AccentName, ColorScheme, getThemeColors, loadDisplaySettings, saveDisplaySettings, spacing, radius } from "@/src/theme";
import { useAuth } from "@/src/auth";

export default function Settings(){
 const router=useRouter(); const {signOut}=useAuth();
 const [scheme,setScheme]=useState<ColorScheme>("light"); const [accent,setAccent]=useState<AccentName>("green");
 useEffect(()=>{loadDisplaySettings().then(x=>{setScheme(x.scheme);setAccent(x.accent);});},[]);
 const pick=async(s:ColorScheme,a:AccentName)=>{setScheme(s);setAccent(a);await saveDisplaySettings(s,a);};
 const c=getThemeColors(scheme,accent);
 return <View style={[styles.root,{backgroundColor:c.surface}]}><SafeAreaView edges={["top"]}><View style={styles.header}><Pressable onPress={()=>router.back()}><Icon name="chevron-back" size={26} color={c.onSurface}/></Pressable><Text style={[styles.title,{color:c.onSurface}]}>Settings</Text><View style={{width:26}}/></View></SafeAreaView>
 <ScrollView contentContainerStyle={styles.content}>
  <Text style={[styles.sectionTitle,{color:c.onSurface}]}>Display</Text><Text style={[styles.sub,{color:c.muted}]}>Choose how Circle looks on this device.</Text>
  <View style={[styles.card,{backgroundColor:c.surfaceSecondary}]}>
   <Text style={[styles.label,{color:c.onSurface}]}>Appearance</Text><View style={styles.segment}>
    {(["light","dark"] as ColorScheme[]).map(x=><Pressable key={x} onPress={()=>pick(x,accent)} style={[styles.segmentBtn,{borderColor:c.border},scheme===x&&{backgroundColor:c.brandPrimary,borderColor:c.brandPrimary}]}><Icon name={x==="light"?"sunny-outline":"moon-outline"} size={18} color={scheme===x?"#FFF":c.onSurface}/><Text style={[styles.segmentText,{color:scheme===x?"#FFF":c.onSurface}]}>{x==="light"?"Light":"Night"}</Text></Pressable>)}
   </View>
   <Text style={[styles.label,{color:c.onSurface,marginTop:22}]}>Accent color</Text><View style={styles.colors}>{accentOptions.map(a=>{const p=getThemeColors(scheme,a);return <Pressable key={a} onPress={()=>pick(scheme,a)} style={styles.colorItem}><View style={[styles.swatch,{backgroundColor:p.brandPrimary},accent===a&&{borderColor:c.onSurface,borderWidth:3}]}>{accent===a&&<Icon name="checkmark" size={20} color="#FFF"/>}</View><Text style={[styles.colorName,{color:c.muted}]}>{a[0].toUpperCase()+a.slice(1)}</Text></Pressable>})}</View>
   <Text style={[styles.note,{color:c.muted}]}>Your choice changes Circle's buttons, tabs, highlights, icons and other accent elements.</Text>
  </View>
  <Text style={[styles.sectionTitle,{color:c.onSurface,marginTop:28}]}>Account</Text>
  <Pressable style={[styles.signout,{borderColor:c.error}]} onPress={()=>Alert.alert("Sign out?","You'll need to sign in again to use Circle.",[{text:"Cancel",style:"cancel"},{text:"Sign out",style:"destructive",onPress:async()=>{await signOut();router.replace("/(auth)/welcome");}}])}><Icon name="log-out-outline" size={20} color={c.error}/><Text style={[styles.signoutText,{color:c.error}]}>Sign out</Text></Pressable>
 </ScrollView></View>;
}
const styles=StyleSheet.create({root:{flex:1},header:{height:54,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:spacing.xl},title:{fontSize:20,fontWeight:"900"},content:{padding:spacing.xl,paddingBottom:50},sectionTitle:{fontSize:19,fontWeight:"900"},sub:{fontSize:12,marginTop:4,marginBottom:14},card:{padding:spacing.lg,borderRadius:radius.lg},label:{fontSize:14,fontWeight:"800"},segment:{flexDirection:"row",gap:10,marginTop:10},segmentBtn:{flex:1,borderWidth:1.5,borderRadius:radius.md,paddingVertical:12,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:7},segmentText:{fontWeight:"800"},colors:{flexDirection:"row",flexWrap:"wrap",marginTop:12,rowGap:16},colorItem:{width:"20%",alignItems:"center",gap:5},swatch:{width:42,height:42,borderRadius:21,alignItems:"center",justifyContent:"center"},colorName:{fontSize:10,fontWeight:"700"},note:{fontSize:11,lineHeight:16,marginTop:18},signout:{borderWidth:1.5,borderRadius:radius.md,padding:15,flexDirection:"row",alignItems:"center",justifyContent:"center",gap:8},signoutText:{fontSize:14,fontWeight:"900"}});
