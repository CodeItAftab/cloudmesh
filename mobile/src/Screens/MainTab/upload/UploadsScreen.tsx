import React from "react";
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useUploadUIStore,
  useCombinedUploadList,
} from "../../../lib/upload/uploadUIStore";
import { processUploadQueue } from "../../../lib/upload/uploadRunner";
import {
  getSpeedBytesPerSec,
  getETASeconds,
  formatSpeed,
  formatETA,
} from "../../../lib/upload/speedTracker";

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function UploadsScreen() {
  const insets = useSafeAreaInsets();
  const combinedList = useCombinedUploadList();
  const cancelItem = useUploadUIStore((s) => s.cancelItem);
  const retryItem = useUploadUIStore((s) => s.retryItem);
  const clearFinished = useUploadUIStore((s) => s.clearFinished);

  // Check if there is anything to actually clear
  const hasFinishedItems = combinedList.some(
    (item) =>
      item.status === "completed" ||
      item.status === "failed" ||
      item.status === "cancelled",
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Uploads</Text>
        {hasFinishedItems && (
          <TouchableOpacity onPress={() => clearFinished()} activeOpacity={0.7}>
            <Text style={styles.clearAction}>Clear history</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={combinedList}
        keyExtractor={(item) => item.fileId}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cloud-upload-outline" size={48} color="#94A3B8" />
            <Text style={styles.emptyText}>
              All quiet here. No uploads yet.
            </Text>
          </View>
        }
        renderItem={({ item }) => {
          const canCancel =
            item.status === "planning" || item.status === "uploading";
          const isFailed = item.status === "failed";

          // UI Theme colors based on status
          const theme = {
            failed: { color: "#EF4444", icon: "alert-circle", bg: "#FEF2F2" },
            cancelled: { color: "#64748B", icon: "ban", bg: "#F8FAFC" },
            completed: {
              color: "#10B981",
              icon: "checkmark-circle",
              bg: "#ECFDF5",
            },
            planning: {
              color: "#3B82F6",
              icon: "ellipsis-horizontal-circle",
              bg: "#EFF6FF",
            },
            uploading: {
              color: "#3B82F6",
              icon: "arrow-up-circle",
              bg: "#EFF6FF",
            },
          }[item.status] || {
            color: "#3B82F6",
            icon: "cloud-upload",
            bg: "#EFF6FF",
          };

          const bytesRemaining = item.totalBytes - item.bytesSent;
          const speed =
            item.status === "uploading" ? getSpeedBytesPerSec(item.fileId) : 0;
          const eta =
            item.status === "uploading"
              ? getETASeconds(item.fileId, bytesRemaining)
              : null;

          const speedLabel = formatSpeed(speed);
          const etaLabel = formatETA(eta);

          return (
            <View style={styles.row}>
              <View style={styles.rowLayout}>
                {/* Status Leading Icon */}
                <View
                  style={[styles.iconContainer, { backgroundColor: theme.bg }]}
                >
                  <Ionicons
                    name={theme.icon as any}
                    size={22}
                    color={theme.color}
                  />
                </View>

                {/* Content Block */}
                <View style={styles.contentBlock}>
                  <View style={styles.titleRow}>
                    <Text style={styles.filename} numberOfLines={1}>
                      {item.filename}
                    </Text>
                    {canCancel && (
                      <TouchableOpacity
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                        onPress={() => cancelItem(item.fileId)}
                      >
                        <Ionicons name="close" size={18} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Dynamic Metadata Meta Line */}
                  <Text style={styles.metaText}>
                    {item.status === "planning" && "Preparing upload plan…"}
                    {item.status === "uploading" &&
                      `${speedLabel || "Uploading"} • ${etaLabel || "calculating..."}`}
                    {item.status === "completed" &&
                      `Completed • ${formatSize(item.totalBytes)}`}
                    {item.status === "failed" &&
                      (item.failureReason || "Upload failed")}
                    {item.status === "cancelled" && "Cancelled"}
                  </Text>

                  {/* Progress bar tracking line */}
                  {item.status !== "planning" && (
                    <View style={styles.progressRow}>
                      <View style={styles.progressTrack}>
                        <View
                          style={[
                            styles.progressBar,
                            {
                              width: `${item.progressPercent}%`,
                              backgroundColor: theme.color,
                            },
                          ]}
                        />
                      </View>
                      {item.status === "uploading" && (
                        <Text style={styles.percentText}>
                          {Math.round(item.progressPercent)}%
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Inline Action Row */}
                  {isFailed && (
                    <TouchableOpacity
                      style={styles.retryButton}
                      onPress={async () => {
                        await retryItem(item.fileId);
                        processUploadQueue();
                      }}
                    >
                      <Ionicons name="refresh" size={13} color="#3B82F6" />
                      <Text style={styles.retryText}>Try again</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.5,
  },
  clearAction: {
    fontSize: 14,
    fontWeight: "600",
    color: "#3B82F6",
  },
  separator: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginLeft: 76, // Align nicely past the status icons
    marginRight: 20,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
    paddingHorizontal: 40,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 12,
    color: "#64748B",
    fontSize: 15,
    fontWeight: "500",
  },
  row: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  rowLayout: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  contentBlock: {
    flex: 1,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filename: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    flex: 1,
    marginRight: 8,
  },
  metaText: {
    fontSize: 13,
    fontWeight: "400",
    color: "#64748B",
    marginTop: 2,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#E2E8F0",
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    borderRadius: 3,
  },
  percentText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginLeft: 8,
    width: 28,
    textAlign: "right",
  },
  retryButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#EFF6FF",
  },
  retryText: {
    marginLeft: 4,
    fontSize: 12,
    fontWeight: "600",
    color: "#3B82F6",
  },
});
