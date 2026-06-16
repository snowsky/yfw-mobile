import { View } from "react-native";

import { useTheme } from "../../theme";

export function Divider({ vertical }: { vertical?: boolean }) {
  const { tokens } = useTheme();
  return (
    <View
      style={
        vertical
          ? { width: 1, alignSelf: "stretch", backgroundColor: tokens.color.border }
          : { height: 1, alignSelf: "stretch", backgroundColor: tokens.color.border }
      }
    />
  );
}
