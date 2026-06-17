import { Pressable } from "react-native";

import { useTheme } from "../../theme";
import { Text } from "./Text";

export interface FilterChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

export function FilterChip({ label, active, onPress }: FilterChipProps) {
  const { tokens } = useTheme();
  const c = tokens.color;
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: tokens.spacing.md,
        paddingVertical: tokens.spacing.sm,
        borderRadius: tokens.radii.full,
        backgroundColor: active ? c.primary : c.surfaceMuted,
        borderWidth: 1,
        borderColor: active ? c.primary : c.border,
      }}
    >
      <Text variant="bodySm" style={{ color: active ? c.onPrimary : c.textMuted }}>{label}</Text>
    </Pressable>
  );
}
