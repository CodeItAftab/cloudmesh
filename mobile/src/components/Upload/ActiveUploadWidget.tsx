import React from "react";
import { View, Text, FlatList, StyleSheet } from "react-native";
import { useUploadUIStore } from "../../lib/upload/uploadUIStore";

export function ActiveUploadsWidget() {
  // Directly binds to the structurally optimized state array reference
  const activeUploads = useUploadUIStore((state) => state.activeUploadList);

  if (activeUploads.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Active Uploads</Text>
      <FlatList
        data={activeUploads}
        keyExtractor={(item) => item.fileId}
        renderItem={({ item }) => (
          <View style={styles.uploadItem}>
            <View style={styles.row}>
              <Text numberOfLines={1} style={styles.filename}>
                {item.filename}
              </Text>
              <Text
                style={[
                  styles.status,
                  { color: item.status === "failed" ? "#FF4D4D" : "#00E676" },
                ]}
              >
                {item.status === "completed"
                  ? "Done"
                  : `${item.progressPercent}%`}
              </Text>
            </View>

            <Text style={styles.subText}>
              {item.status === "completed"
                ? "Finished uploading safely"
                : `Chunk ${item.chunkIndex} of ${item.totalChunks} · ${item.status}`}
            </Text>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${item.progressPercent}%`,
                    backgroundColor:
                      item.status === "failed" ? "#FF4D4D" : "#00E676",
                  },
                ]}
              />
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    maxHeight: 220,
    borderTopWidth: 1,
    borderColor: "#2C2C2E",
    backgroundColor: "#1C1C1E",
  },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#FFFFFF",
  },
  uploadItem: {
    marginBottom: 14,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  filename: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    marginRight: 10,
    color: "#FFFFFF",
  },
  status: {
    fontSize: 13,
    fontWeight: "bold",
  },
  subText: {
    fontSize: 12,
    marginTop: 2,
    textTransform: "capitalize",
    color: "#8E8E93",
  },
  progressTrack: {
    width: "100%",
    height: 4,
    borderRadius: 2,
    marginTop: 8,
    overflow: "hidden",
    backgroundColor: "#2C2C2E",
  },
  progressBar: {
    height: "100%",
  },
});
