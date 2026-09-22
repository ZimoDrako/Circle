import { View, Text, StyleSheet, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Icon from "@react-native-vector-icons/ionicons";
import { colors, spacing, radius } from "@/src/theme";
import { Avatar } from "@/src/ui";
import { MainTabBar } from "@/src/components/main-tab-bar";

const items=[
 {icon:"person-add",title:"New connection request",text:"A student you matched with wants to connect.",time:"Now",action:"View"},
 {icon:"calendar",title:"Tonight on campus",text:"Events matching your interests are happening tonight.",time:"Today",action:"Explore"},
 {icon:"people",title:"Your Daily Circle",text:"Tell Circle what you want to do and find people for today.",time:"Today",action:"Match"},
];
export default function Activity(){
 const router=useRouter();
 return <SafeAreaView style={styles.root} edges={["top"]}>
  <View style={styles.header}><Pressable onPress={()=>router.replace("/(tabs)/home")} style={styles.back}><Icon name="chevron-back" size={24} color={colors.onSurface}/></Pressable><Text style={styles.title}>Activity</Text><View style={{width:42}}/></View>
  <ScrollView contentContainerStyle={styles.content}>
   <Text style={styles.heading}>What's happening</Text><Text style={styles.sub}>Invites, connections and things worth doing.</Text>
   {items.map((x,i)=><View key={x.title} style={styles.item}><View style={styles.icon}><Icon name={x.icon as any} size={20} color={colors.brandPrimary}/></View><View style={{flex:1}}><Text style={styles.itemTitle}>{x.title}</Text><Text style={styles.itemText}>{x.text}</Text><Text style={styles.time}>{x.time}</Text></View><Pressable onPress={()=>router.replace(i===2?"/daily-circle":"/(tabs)/discover")} style={styles.action}><Text style={styles.actionText}>{x.action}</Text></Pressable></View>)}
   <Text style={styles.note}>This is the Activity preview. Live invitations, incoming requests and personalized notifications are the next backend feature.</Text>
  </ScrollView><MainTabBar/>
 </SafeAreaView>
}
const styles=StyleSheet.create({root:{flex:1,backgroundColor:colors.surface},header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:spacing.lg,paddingVertical:spacing.md,borderBottomWidth:1,borderBottomColor:colors.divider},back:{width:42,height:42,alignItems:"center",justifyContent:"center"},title:{fontSize:17,fontWeight:"700",color:colors.onSurface},content:{padding:spacing.xl,paddingBottom:120},heading:{fontSize:27,fontWeight:"800",color:colors.onSurface},sub:{fontSize:14,color:colors.muted,marginTop:4,marginBottom:spacing.xl},item:{flexDirection:"row",alignItems:"center",gap:spacing.md,paddingVertical:spacing.lg,borderBottomWidth:1,borderBottomColor:colors.divider},icon:{width:44,height:44,borderRadius:22,backgroundColor:colors.brandTertiary,alignItems:"center",justifyContent:"center"},itemTitle:{fontSize:14,fontWeight:"800",color:colors.onSurface},itemText:{fontSize:12,lineHeight:17,color:colors.muted,marginTop:2},time:{fontSize:10,color:colors.muted,marginTop:5},action:{paddingHorizontal:12,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.brandPrimary},actionText:{fontSize:11,fontWeight:"800",color:colors.onBrandPrimary},note:{fontSize:11,lineHeight:17,color:colors.muted,textAlign:"center",marginTop:spacing.xl,paddingHorizontal:spacing.xl}});
