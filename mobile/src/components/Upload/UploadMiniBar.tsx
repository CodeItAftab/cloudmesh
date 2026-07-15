import React, { memo } from "react";
import {
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useCombinedUploadList } from "../../lib/upload/uploadUIStore";

function UploadMiniBarInner() {
  const combinedList = useCombinedUploadList();
  const navigation = useNavigation<any>();

  const inFlight = combinedList.filter(
    (u) => u.status === "planning" || u.status === "uploading",
  );
  const failed = combinedList.filter((u) => u.status === "failed");

  if (inFlight.length === 0 && failed.length === 0) return null;

  const isPlanning =
    inFlight.length > 0 && inFlight.every((u) => u.status === "planning");
  const uploading = inFlight.filter((u) => u.status === "uploading");
  const avgProgress =
    uploading.length > 0
      ? Math.round(
          uploading.reduce((sum, u) => sum + u.progressPercent, 0) /
            uploading.length,
        )
      : 0;

  let label: string;
  if (isPlanning) {
    label =
      inFlight.length === 1
        ? "Fetching upload plan…"
        : `Preparing ${inFlight.length} files…`;
  } else if (inFlight.length > 0) {
    label = `Uploading ${inFlight.length} file${inFlight.length > 1 ? "s" : ""} • ${avgProgress}%`;
  } else {
    label = `${failed.length} upload${failed.length > 1 ? "s" : ""} failed`;
  }

  return (
    <TouchableOpacity
      style={styles.bar}
      activeOpacity={0.85}
      onPress={() =>
        navigation.navigate("FilesTab", { screen: "UploadsScreen" })
      }
    >
      {inFlight.length > 0 ? (
        <ActivityIndicator
          size="small"
          color="#0066FF"
          style={{ marginRight: 10 }}
        />
      ) : (
        <Ionicons
          name="alert-circle"
          size={18}
          color="#EF4444"
          style={{ marginRight: 10 }}
        />
      )}
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 20,
    right: 90, // clears the 52px FAB (right:20) plus margin
    bottom: 30,
    height: 44,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 50,
  },
  label: { flex: 1, fontSize: 13, fontWeight: "600", color: "#0F172A" },
});

export const UploadMiniBar = memo(UploadMiniBarInner);
