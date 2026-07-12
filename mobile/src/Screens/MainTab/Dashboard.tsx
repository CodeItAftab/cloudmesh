// src/Screens/Dashboard/DashboardScreen.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

// Component Module Layout Imports
import { DashboardSkeleton } from "../../components/Dashboard/DashboardSkeleton";
import { StorageMetricCard } from "../../components/Dashboard/StorageMetricCard";
import { RecentActivityList } from "../../components/Dashboard/RecentActivityList";
import { ConnectedStorageModal } from "../../components/Dashboard/ConnectedStorageModal";
import { DashboardData, getDashboardStats } from "../../lib/api/drive";

interface StorageAccount {
  id: string;
  provider: "google" | "onedrive" | "dropbox";
  providerLabel: string;
  email: string;
  usedSpaceGB: number;
  totalSpaceGB: number;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
}

export function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const [isInitialLoading, setIsInitialLoading] = useState(false);
  const [isSyncingStats, setIsSyncingStats] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [stats, setStats] = useState<DashboardData | null>(null);

  const loadDashboardStats = useCallback(async () => {
    try {
      setIsSyncingStats(true);
      const result = await getDashboardStats();
      setIsSyncingStats(false);
      setStats(result);
    } catch (error) {
      setIsSyncingStats(false);
      console.error("Error fetching dashboard stats:", error);
    }
  }, []);

  // useEffect(() => {
  //   const initTimer = setTimeout(() => setIsInitialLoading(false), 1400);
  //   const syncTimer = setTimeout(() => setIsSyncingStats(false), 4000);
  //   return () => {
  //     clearTimeout(initTimer);
  //     clearTimeout(syncTimer);
  //   };
  // }, []);

  useEffect(() => {
    loadDashboardStats();
  }, []);

  const onRefresh = useCallback(() => {
    try {
      setIsRefreshing(true);
      loadDashboardStats().finally(() => setIsRefreshing(false));
    } catch (error) {
      console.error("Error refreshing dashboard stats:", error);
      setIsRefreshing(false);
    }
  }, []);

  if (isInitialLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <DashboardSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topAmbientGlowOrphic} />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 20 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor="#0066FF"
            colors={["#0066FF"]}
            progressViewOffset={insets.top}
          />
        }
      >
        {/* HEADER BLOCK */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.welcomeText}>Welcome back, Aftab</Text>
            <Text
              style={[
                styles.systemStatusText,
                isSyncingStats && { color: "#D97706" },
              ]}
            >
              {isSyncingStats
                ? "⚡ Mapping active shards..."
                : "✓ Storage environment secure"}
            </Text>
          </View>
          <View style={styles.statusIndicatorContainer}>
            <View
              style={[
                styles.pulseDotGlobal,
                isSyncingStats && { backgroundColor: "#F59E0B" },
              ]}
            />
            <Text
              style={[
                styles.activeNodesBadge,
                isSyncingStats && { color: "#D97706" },
              ]}
            >
              {isSyncingStats ? "SYNCING" : "LIVE"}
            </Text>
          </View>
        </View>

        {/* METRICS GRAPH CARD PANEL */}
        <StorageMetricCard
          isSyncingStats={isSyncingStats}
          usedSpaceGB={parseFloat(
            (parseInt(stats?.usedQuotaBytes ?? "0") / 1024 ** 3).toFixed(2),
          )}
          totalSpaceGB={parseFloat(
            (parseInt(stats?.totalQuotaBytes ?? "0") / 1024 ** 3).toFixed(2),
          )}
          onPress={() => setIsModalVisible(true)}
        />

        {/* RECENT UPLOADS HEADER SECTION */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitleText}>Recent Feed Activity</Text>
          <Ionicons name="time-outline" size={15} color="#94A3B8" />
        </View>

        {/* 🟢 NEW COMPONENT INJECTED: Handles inline skeletons or tight file logs internally */}
        <RecentActivityList isSyncingStats={isSyncingStats} />
      </ScrollView>

      {/* CLOUD ENVIRONMENT DETAILS OVERLAY LAYER */}
      <ConnectedStorageModal
        isVisible={isModalVisible}
        accounts={stats?.accounts || []}
        onClose={() => setIsModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  topAmbientGlowOrphic: {
    position: "absolute",
    top: -100,
    left: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(0, 102, 255, 0.04)",
    pointerEvents: "none",
  },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 40 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.8,
  },
  systemStatusText: {
    fontSize: 13,
    color: "#16A34A",
    marginTop: 4,
    fontWeight: "600",
  },
  statusIndicatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.8)",
  },
  pulseDotGlobal: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
    marginRight: 6,
  },
  activeNodesBadge: {
    fontSize: 10,
    fontWeight: "900",
    color: "#16A34A",
    letterSpacing: 0.8,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  sectionTitleText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#334155",
    letterSpacing: -0.2,
  },
});
