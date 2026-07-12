import React, { useEffect, useRef } from "react";
import {
  StyleSheet,
  Platform,
  Pressable,
  StyleProp,
  ViewStyle,
  Animated,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// --- Keep your existing Screen Placeholders / Components ---
import { View, Text } from "react-native";
import { DashboardScreen } from "../Screens/MainTab/Dashboard";
import { FilesNavigator } from "./FilesNavigator";
function DashboardPlaceholder() {
  return (
    <View style={styles.screen}>
      <Text style={styles.screenText}>Dashboard Viewport Active</Text>
    </View>
  );
}
function FilesPlaceholder() {
  return (
    <View style={styles.screen}>
      <Text style={styles.screenText}>Files Viewport Active</Text>
    </View>
  );
}
function SettingsPlaceholder() {
  return (
    <View style={styles.screen}>
      <Text style={styles.screenText}>System Settings Viewport Active</Text>
    </View>
  );
}
// -----------------------------------------------------------

// High-Performance Animated Icon Scale Component
function AnimatedTabIcon({
  name,
  color,
  focused,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  focused: boolean;
}) {
  const scaleValue = useRef(new Animated.Value(focused ? 1.08 : 1.0)).current;

  useEffect(() => {
    Animated.spring(scaleValue, {
      toValue: focused ? 1.08 : 1.0,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [focused]);

  return (
    <Animated.View
      style={[styles.iconWrapper, { transform: [{ scale: scaleValue }] }]}
    >
      <Ionicons name={name} size={22} color={color} />
    </Animated.View>
  );
}

const Tab = createBottomTabNavigator();

export function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const isAndroid = Platform.OS === "android";
  const bottomInset = insets.bottom;

  // Balanced container heights for the size-22 layout profile
  const tabBarHeight = isAndroid
    ? bottomInset > 0
      ? 66 + bottomInset
      : 74
    : 90;
  const paddingBottomCalculated = isAndroid
    ? bottomInset > 0
      ? bottomInset + 6
      : 14
    : 28;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          let iconName: keyof typeof Ionicons.glyphMap = "layers-outline";
          if (route.name === "Dashboard")
            iconName = focused ? "grid" : "grid-outline";
          else if (route.name === "Files")
            iconName = focused ? "folder-open" : "folder-open-outline";
          else if (route.name === "Settings")
            iconName = focused ? "options" : "options-outline";

          return (
            <AnimatedTabIcon name={iconName} color={color} focused={focused} />
          );
        },
        tabBarActiveTintColor: "#0066FF",
        tabBarInactiveTintColor: "#94A3B8",
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: styles.tabLabel,

        animationEnabled: true,

        tabBarButton: (props) => {
          const { style, ref, ...restProps } = props;

          return (
            <Pressable
              {...restProps}
              android_ripple={null}
              style={({ pressed }) => [
                style as StyleProp<ViewStyle>,
                { opacity: pressed ? 0.8 : 1.0 },
              ]}
            />
          );
        },

        tabBarStyle: [
          styles.tabBarContainer,
          {
            height: tabBarHeight,
            paddingBottom: paddingBottomCalculated,
          },
        ],
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen
        name="FilesTab"
        component={FilesNavigator}
        options={{ tabBarLabel: "Files" }}
      />
      <Tab.Screen name="Settings" component={SettingsPlaceholder} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 0,
  },
  iconWrapper: {
    width: 26,
    height: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: -0.1,
    marginTop: 4,
  },
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
  },
  screenText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
  },
});
