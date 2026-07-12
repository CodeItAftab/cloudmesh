// src/Components/Dashboard/RecentActivityList.tsx
import React from "react";
import { StyleSheet, View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DashboardSkeleton } from "./DashboardSkeleton";

interface RecentActivityListProps {
  isSyncingStats: boolean;
}

export function RecentActivityList({
  isSyncingStats,
}: RecentActivityListProps) {
  if (isSyncingStats) {
    return <DashboardSkeleton isInlineFilesOnly={true} />;
  }

  return (
    <View style={styles.activityList}>
      {/* File Item A */}
      <View style={styles.fileItem}>
        <View style={styles.fileItemLeft}>
          <View style={[styles.fileIconBox, { backgroundColor: "#DBEAFE" }]}>
            <Ionicons name="document-text" size={20} color="#2563EB" />
          </View>
          <View style={styles.fileTextContainer}>
            <Text style={styles.fileNameText} numberOfLines={1}>
              Project_Proposal.pdf
            </Text>
            <Text style={styles.fileMetaText}>
              Google Drive Cluster • 2m ago
            </Text>
          </View>
        </View>
        <Text style={styles.fileSizeBadge}>2.4 MB</Text>
      </View>

      {/* File Item B */}
      <View style={styles.fileItem}>
        <View style={styles.fileItemLeft}>
          <View style={[styles.fileIconBox, { backgroundColor: "#E0F2FE" }]}>
            <Ionicons name="stats-chart" size={18} color="#0384C7" />
          </View>
          <View style={styles.fileTextContainer}>
            <Text style={styles.fileNameText} numberOfLines={1}>
              Financial_Report.xlsx
            </Text>
            <Text style={styles.fileMetaText}>
              OneDrive Allocation Layer • 24m ago
            </Text>
          </View>
        </View>
        <Text style={styles.fileSizeBadge}>1.1 MB</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 🟢 Decreased the inter-item vertical layout gap down to 10px
  activityList: {
    gap: 10,
  },
  fileItem: {
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.7)",
    borderRadius: 24,
    padding: 16,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.01,
    shadowRadius: 8,
    elevation: 1,
  },
  fileItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  fileIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  fileTextContainer: {
    flex: 1,
    paddingRight: 8,
  },
  fileNameText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
    letterSpacing: -0.1,
  },
  fileMetaText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 3,
    fontWeight: "600",
  },
  fileSizeBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    backgroundColor: "#F1F5F9",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
});
