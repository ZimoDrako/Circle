import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { LogBox } from "react-native";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { AuthProvider } from "@/src/auth";
import { ThemeProvider, useTheme } from "@/src/theme";

LogBox.ignoreAllLogs(true);

function ThemedApp() {
  const { colors, scheme } = useTheme();
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <KeyboardProvider>
              <AuthProvider>
                <StatusBar style={scheme === "dark" ? "light" : "dark"} />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.surface },
                    animation: "fade_from_bottom",
                    animationDuration: 180,
                    gestureEnabled: true,
                    fullScreenGestureEnabled: true,
                  }}
                >
                  <Stack.Screen name="(tabs)" options={{ animation: "none" }} />
                  <Stack.Screen name="circle/[id]" options={{ animation: "slide_from_bottom" }} />
                  <Stack.Screen name="daily-circle" options={{ animation: "slide_from_bottom" }} />
                </Stack>
              </AuthProvider>
            </KeyboardProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

export default function RootLayout() {
  return <ThemeProvider><ThemedApp /></ThemeProvider>;
}
