import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/src/auth";
import { colors } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/(auth)/welcome");
    else if (!user.onboarded) router.replace("/onboarding/1");
    else router.replace("/(tabs)/home");
  }, [user, loading]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
      <ActivityIndicator color={colors.brandPrimary} />
    </View>
  );
}
