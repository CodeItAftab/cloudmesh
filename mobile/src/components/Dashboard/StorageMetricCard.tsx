import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Text, Animated, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";

interface StorageMetricCardProps {
  isSyncingStats: boolean;
  usedSpaceGB: number;
  totalSpaceGB: number;
  onPress: () => void;
}

export function StorageMetricCard({
  isSyncingStats,
  usedSpaceGB,
  totalSpaceGB,
  onPress,
}: StorageMetricCardProps) {
  const syncPulse = useRef(new Animated.Value(0.6)).current;
  const chartScale = useRef(new Animated.Value(0.9)).current;
  const cardScale = useRef(new Animated.Value(1)).current;

  // Safeguard against division by zero and extreme values
  const safeTotalSpace = totalSpaceGB <= 0 ? 1 : totalSpaceGB;
  const freeSpaceGB = Math.max(0, totalSpaceGB - usedSpaceGB);
  const usedPercentage = Math.min(
    100,
    Math.max(0, (usedSpaceGB / safeTotalSpace) * 100),
  );

  console.log(
    `StorageMetricCard: usedSpaceGB=${usedSpaceGB}, totalSpaceGB=${totalSpaceGB}, freeSpaceGB=${freeSpaceGB}, usedPercentage=${usedPercentage.toFixed(2)}%`,
  );

  useEffect(() => {
    if (isSyncingStats) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(syncPulse, {
            toValue: 1.0,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(syncPulse, {
            toValue: 0.6,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    } else {
      Animated.spring(chartScale, {
        toValue: 1,
        tension: 40,
        friction: 7,
        useNativeDriver: true,
      }).start();
    }
  }, [isSyncingStats, chartScale, syncPulse]);

  const handlePressIn = () => {
    Animated.timing(cardScale, {
      toValue: 0.96,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(cardScale, {
      toValue: 1,
      friction: 5,
      tension: 45,
      useNativeDriver: true,
    }).start();
  };

  // Radial SVG geometry calculations
  const radius = 38;
  const strokeWidth = 10;
  const circumference = 2 * Math.PI * radius; // Approx 238.76
  const strokeDashoffset =
    circumference - (usedPercentage / 100) * circumference;

  console.log(
    `StorageMetricCard: radius=${radius}, strokeWidth=${strokeWidth}, circumference=${circumference.toFixed(
      2,
    )}, strokeDashoffset=${strokeDashoffset.toFixed(2)}`,
  );

  return (
    <Animated.View style={{ transform: [{ scale: cardScale }] }}>
      <View style={styles.meshMetricCard}>
        {isSyncingStats ? (
          <View style={styles.cardInternalFlexContainer}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabelText}>STORAGE MATRIX POOL</Text>
              <Animated.View style={[styles.syncBadge, { opacity: syncPulse }]}>
                <Text style={styles.syncBadgeText}>Assembling</Text>
              </Animated.View>
            </View>
            <View style={styles.loaderContentContainer}>
              <Text style={styles.calculatingTitle}>
                Mapping data shards...
              </Text>
              <Text style={styles.calculatingSubtitle}>
                Synchronizing high-density indexes across secure remote
                endpoints.
              </Text>
            </View>
            <View style={styles.progressTrackContainer}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: "40%", backgroundColor: "#E2E8F0" },
                ]}
              />
            </View>
          </View>
        ) : (
          <Pressable
            style={styles.cardInternalFlexContainer}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onPress}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabelText}>STORAGE MATRIX POOL</Text>
              <View style={styles.infoBadge}>
                <Text style={styles.infoBadgeText}>Clusters</Text>
                <Ionicons name="layers-outline" size={12} color="#0066FF" />
              </View>
            </View>

            <Animated.View
              style={[
                styles.visualChartRow,
                { transform: [{ scale: chartScale }] },
              ]}
            >
              {/* Radial Progress Display */}
              <View style={styles.chartGraphicsFrame}>
                <Svg
                  width="94"
                  height="94"
                  viewBox="0 0 94 94"
                  style={styles.svgRotationContainer}
                >
                  {/* Background Track Circle */}
                  <Circle
                    cx="47"
                    cy="47"
                    r={radius}
                    stroke="#F1F5F9"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                  />
                  {/* Active Dynamic Segment */}
                  {usedPercentage > 0 && (
                    <Circle
                      cx="47"
                      cy="47"
                      r={radius}
                      stroke="#0066FF"
                      strokeWidth={strokeWidth}
                      fill="transparent"
                      strokeDasharray={`${circumference} ${circumference}`}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                    />
                  )}
                </Svg>

                {/* Inner Text Overlay */}
                <View style={styles.chartCenterHoleLabelContainer}>
                  <Text style={styles.chartCenterPercentage}>
                    {usedPercentage.toFixed(1)}%
                  </Text>
                  <Text style={styles.chartCenterSubText}>Used</Text>
                </View>
              </View>

              {/* Chart Data Legend */}
              <View style={styles.chartLegendBlock}>
                <View style={styles.legendMetricsGroup}>
                  <View
                    style={[
                      styles.indicatorPill,
                      { backgroundColor: "#0066FF" },
                    ]}
                  />
                  <View>
                    <Text style={styles.metricLabelText}>Virtual Used</Text>
                    <Text style={styles.metricValueText}>
                      {usedSpaceGB.toFixed(2)} GB
                    </Text>
                  </View>
                </View>
                <View style={styles.legendMetricsGroup}>
                  <View
                    style={[
                      styles.indicatorPill,
                      { backgroundColor: "#CBD5E1" },
                    ]}
                  />
                  <View>
                    <Text style={styles.metricLabelText}>
                      Available Allocation
                    </Text>
                    <Text style={styles.metricValueText}>
                      {freeSpaceGB.toFixed(2)} GB
                    </Text>
                  </View>
                </View>
              </View>
            </Animated.View>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  meshMetricCard: {
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
    height: 196,
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.03,
    shadowRadius: 24,
    elevation: 3,
    marginBottom: 32,
  },
  cardInternalFlexContainer: { flex: 1, justifyContent: "space-between" },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardLabelText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 1,
  },
  visualChartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
    marginTop: 4,
  },
  chartGraphicsFrame: {
    width: 94,
    height: 94,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  svgRotationContainer: {
    transform: [{ rotate: "-90deg" }], // Anchor point to start clean at 12 o'clock position
  },
  chartCenterHoleLabelContainer: {
    position: "absolute",
    width: 66,
    height: 66,
    backgroundColor: "#FFFFFF",
    borderRadius: 33,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  chartCenterPercentage: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  chartCenterSubText: {
    fontSize: 8,
    fontWeight: "800",
    color: "#94A3B8",
    marginTop: 1,
    letterSpacing: 0.5,
  },
  chartLegendBlock: { flex: 1, gap: 14 },
  legendMetricsGroup: { flexDirection: "row", alignItems: "center", gap: 12 },
  indicatorPill: { width: 4, height: 26, borderRadius: 2 },
  metricLabelText: { fontSize: 11, fontWeight: "600", color: "#64748B" },
  metricValueText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0F172A",
    marginTop: 1,
  },
  syncBadge: {
    backgroundColor: "#FEF3C7",
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  syncBadgeText: { fontSize: 11, fontWeight: "700", color: "#D97706" },
  loaderContentContainer: { marginVertical: 4 },
  calculatingTitle: { fontSize: 16, fontWeight: "800", color: "#1E293B" },
  calculatingSubtitle: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 17,
    marginTop: 4,
    fontWeight: "500",
  },
  progressTrackContainer: {
    height: 6,
    width: "100%",
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#0066FF",
    borderRadius: 3,
  },
  infoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E0F2FE",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  infoBadgeText: { fontSize: 11, fontWeight: "800", color: "#0066FF" },
});
