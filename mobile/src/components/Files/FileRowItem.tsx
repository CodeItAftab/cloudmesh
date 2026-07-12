// src/Components/Files/FileRowItem.tsx
import React from "react";
import { StyleSheet, View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface FileItem {
  id: string;
  name: string;
  type: "folder" | "pdf" | "image" | "spreadsheet";
  meta: string; // e.g., "Google Drive • 2MB" or "32 items"
  size?: string;
}

interface FileRowItemProps {
  item: FileItem;
  onPress: () => void;
}

export function FileRowItem({ item, onPress }: FileRowItemProps) {
  // Map vector styles completely dependent on entity types
  const getTypeConfig = () => {
    switch (item.type) {
      case "folder":
        return { icon: "folder", color: "#F59E0B", bg: "#FEF3C7" }; // Warm folder amber
      case "pdf":
        return { icon: "document-text", color: "#EF4444", bg: "#FEE2E2" }; // Document red
      case "spreadsheet":
        return { icon: "stats-chart", color: "#10B981", bg: "#D1FAE5" }; // Sheet green
      default:
        return { icon: "image", color: "#3B82F6", bg: "#DBEAFE" }; // Media blue
    }
  };

  const config = getTypeConfig();

  return (
    <TouchableOpacity
      style={styles.rowContainer}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.leftFrame}>
        <View style={[styles.iconBox, { backgroundColor: config.bg }]}>
          <Ionicons name={config.icon as any} size={20} color={config.color} />
        </View>
        <View style={styles.textFrame}>
          <Text style={styles.nameText} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.metaText}>{item.meta}</Text>
        </View>
      </View>

      <View style={styles.rightFrame}>
        {item.size && <Text style={styles.sizeText}>{item.size}</Text>}
        <Ionicons name="ellipsis-vertical" size={16} color="#94A3B8" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(226, 232, 240, 0.7)",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.01,
    shadowRadius: 8,
    elevation: 1,
  },
  leftFrame: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingRight: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  textFrame: { flex: 1 },
  nameText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
    letterSpacing: -0.1,
  },
  metaText: { fontSize: 11, color: "#64748B", marginTop: 3, fontWeight: "600" },
  rightFrame: { flexDirection: "row", alignItems: "center", gap: 12 },
  sizeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    backgroundColor: "#F1F5F9",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
});
