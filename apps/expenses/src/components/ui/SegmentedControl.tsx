import { Pressable, View } from "react-native";

import { useTheme } from "../../theme";
import { Text } from "./Text";

export interface SegmentOption<T extends string> {
  label: string;
  value: T;
}

export interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  const { tokens } = useTheme();
  const c = tokens.color;
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: c.surfaceMuted,
        borderRadius: tokens.radii.lg,
        padding: 3,
        gap: 3,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              { flex: 1, alignItems: "center", paddingVertical: tokens.spacing.sm, borderRadius: tokens.radii.md },
              active ? { backgroundColor: c.surface, ...tokens.shadow.soft } : null,
            ]}
          >
            <Text variant="bodySm" style={{ color: active ? c.text : c.textMuted }}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
