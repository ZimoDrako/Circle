// Shared UI atoms.
import React from "react";
import { Pressable, Text, View, ActivityIndicator, StyleSheet, ViewStyle, TextStyle, StyleProp } from "react-native";
import { Image } from "expo-image";
import { colors, radius, spacing } from "./theme";
import Icon from "@react-native-vector-icons/ionicons";

export function Button({
  label,
  onPress,
  variant = "primary",
  loading,
  disabled,
  testID,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const isDisabled = disabled || loading;
  const bg =
    variant === "primary" ? colors.brandPrimary : variant === "secondary" ? colors.surfaceTertiary : "transparent";
  const fg =
    variant === "primary" ? colors.onBrandPrimary : variant === "secondary" ? colors.onSurfaceTertiary : colors.onSurface;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          paddingVertical: 14,
          paddingHorizontal: spacing.xl,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          minHeight: 48,
          flexDirection: "row",
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontSize: 16, fontWeight: "600" }}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        backgroundColor: selected ? colors.brandTertiary : colors.surfaceSecondary,
        borderWidth: 1,
        borderColor: selected ? colors.brandPrimary : colors.border,
      }}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: selected ? "600" : "500",
          color: selected ? colors.onBrandTertiary : colors.onSurfaceSecondary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Avatar({
  uri,
  name,
  size = 44,
}: {
  uri?: string | null;
  name?: string;
  size?: number;
}) {
  const initials = (name || "?")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceTertiary }}
        contentFit="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.brandTertiary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: colors.onBrandTertiary, fontWeight: "700", fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

export function CompatibilityBadge({ score }: { score: number }) {
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radius.pill,
        backgroundColor: colors.brandPrimary,
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
      }}
    >
      <Icon name="sparkles" size={12} color={colors.onBrandPrimary} />
      <Text style={{ color: colors.onBrandPrimary, fontWeight: "700", fontSize: 12 }}>{score}%</Text>
    </View>
  );
}

export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing.md,
        marginTop: spacing.md,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: "700", color: colors.onSurface }}>{title}</Text>
      {action && (
        <Pressable onPress={onAction}>
          <Text style={{ color: colors.brandPrimary, fontWeight: "600" }}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ padding: spacing.xl, alignItems: "center", justifyContent: "center", flex: 1 }}>
      <Icon name="sparkles-outline" size={44} color={colors.muted} />
      <Text style={{ fontSize: 16, fontWeight: "600", color: colors.onSurface, marginTop: spacing.md }}>{title}</Text>
      {subtitle && (
        <Text style={{ fontSize: 14, color: colors.muted, marginTop: spacing.xs, textAlign: "center" }}>{subtitle}</Text>
      )}
    </View>
  );
}
