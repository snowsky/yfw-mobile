import { Platform, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { Redirect, Tabs } from "expo-router";
import { Feather } from "@expo/vector-icons";

import { useAuth } from "../../src/providers/AuthProvider";

export default function TabsLayout() {
  const { isReady, accessToken } = useAuth();

  if (!isReady) return null;
  if (!accessToken) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#059669",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: {
          position: "absolute",
          bottom: Platform.OS === "ios" ? 28 : 20,
          left: 16,
          right: 16,
          height: 66,
          borderRadius: 24,
          backgroundColor: Platform.OS === "ios" ? "rgba(255, 255, 255, 0.85)" : "#ffffff",
          shadowColor: "#0f172a",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.12,
          shadowRadius: 18,
          elevation: 5,
          borderTopWidth: 0,
          paddingBottom: Platform.OS === "ios" ? 0 : 4,
          paddingTop: 4,
          overflow: "hidden",
        },
        tabBarBackground: Platform.OS === "ios" ? () => (
          <BlurView tint="light" intensity={60} style={StyleSheet.absoluteFill} />
        ) : undefined,
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "Outfit_600SemiBold",
          marginTop: -2,
          marginBottom: 4,
        },
        tabBarIconStyle: {
          marginTop: 2,
        }
      }}
    >
      <Tabs.Screen
        name="capture"
        options={{
          title: "Capture",
          tabBarIcon: ({ color, size }) => <Feather name="camera" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color, size }) => <Feather name="inbox" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: "Timeline",
          tabBarIcon: ({ color, size }) => <Feather name="list" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: "Insights",
          tabBarIcon: ({ color, size }) => <Feather name="bar-chart-2" size={size} color={color} />
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <Feather name="settings" size={size} color={color} />
        }}
      />
    </Tabs>
  );
}
