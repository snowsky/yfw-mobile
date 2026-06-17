import { View } from "react-native";

import { useTheme } from "../../theme";
import { Text } from "./Text";

export function Avatar({ initials, size = 48 }: { initials: string; size?: number }) {
  const { tokens } = useTheme();
  return (
    <View
      style={{
        width: size, height: size, borderRadius: size / 2,
        backgroundColor: tokens.color.primaryMuted,
        alignItems: "center", justifyContent: "center",
      }}
    >
      <Text variant="headingSm" color="primary">{initials}</Text>
    </View>
  );
}
