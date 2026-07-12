import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Animated } from "react-native";

interface DashboardSkeletonProps {
  isInlineFilesOnly?: boolean;
}

export function DashboardSkeleton({
  isInlineFilesOnly = false,
}: DashboardSkeletonProps) {
  const skeletonAlpha = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonAlpha, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(skeletonAlpha, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [skeletonAlpha]);

  // If we only need a placeholder for the files list during pull-to-refresh:
  if (isInlineFilesOnly) {
    return (
      <View style={{ gap: 12 }}>
        <Animated.View
          style={[
            styles.skeletonLine,
            {
              width: "100%",
              height: 68,
              borderRadius: 20,
              opacity: skeletonAlpha,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.skeletonLine,
            {
              width: "100%",
              height: 68,
              borderRadius: 20,
              opacity: skeletonAlpha,
            },
          ]}
        />
      </View>
    );
  }

  // Default Full Screen Cold Boot Skeleton
  return (
    <View style={styles.container}>
      <View style={[styles.headerRow, { marginBottom: 32 }]}>
        <View style={{ gap: 6 }}>
          <Animated.View
            style={[
              styles.skeletonLine,
              { width: 160, height: 24, opacity: skeletonAlpha },
            ]}
          />
          <Animated.View
            style={[
              styles.skeletonLine,
              { width: 190, height: 12, opacity: skeletonAlpha },
            ]}
          />
        </View>
        <Animated.View
          style={[
            styles.skeletonLine,
            { width: 80, height: 26, borderRadius: 13, opacity: skeletonAlpha },
          ]}
        />
      </View>
      <Animated.View
        style={[styles.meshMetricCard, { opacity: skeletonAlpha }]}
      />
      <Animated.View
        style={[
          styles.skeletonLine,
          { width: 130, height: 16, marginBottom: 16, opacity: skeletonAlpha },
        ]}
      />
      <View style={{ gap: 12 }}>
        <Animated.View
          style={[
            styles.skeletonLine,
            {
              width: "100%",
              height: 68,
              borderRadius: 20,
              opacity: skeletonAlpha,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.skeletonLine,
            {
              width: "100%",
              height: 68,
              borderRadius: 20,
              opacity: skeletonAlpha,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, backgroundColor: "#FFFFFF" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  skeletonLine: { backgroundColor: "#F1F5F9", borderRadius: 6 },
  meshMetricCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    height: 190,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    marginBottom: 32,
  },
});
