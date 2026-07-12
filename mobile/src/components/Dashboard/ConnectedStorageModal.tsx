import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Modal,
  Animated,
  Pressable,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ConnectedAccount } from "../../lib/api/drive";

interface ConnectedStorageModalProps {
  isVisible: boolean;
  accounts: ConnectedAccount[];
  onClose: () => void;
}

export function ConnectedStorageModal({
  isVisible,
  accounts,
  onClose,
}: ConnectedStorageModalProps) {
  const [isFetchingAccounts, setIsFetchingAccounts] = useState(false);

  const modalFade = useRef(new Animated.Value(0)).current;
  const shimmerAlpha = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    if (isVisible) {
      Animated.timing(modalFade, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();

      // setIsFetchingAccounts(true);
      // Animated.loop(
      //   Animated.sequence([
      //     Animated.timing(shimmerAlpha, {
      //       toValue: 0.7,
      //       duration: 600,
      //       useNativeDriver: true,
      //     }),
      //     Animated.timing(shimmerAlpha, {
      //       toValue: 0.3,
      //       duration: 600,
      //       useNativeDriver: true,
      //     }),
      //   ]),
      // ).start();

      // const timer = setTimeout(() => {
      //   setIsFetchingAccounts(false);
      // }, 1000);

      // return () => clearTimeout(timer);
    } else {
      Animated.timing(modalFade, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isVisible, modalFade, shimmerAlpha]);

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.modalViewportContainer}>
        <Animated.View
          style={[styles.modalBackdropScrim, { opacity: modalFade }]}
        >
          <Pressable style={styles.scrimDismissArea} onPress={onClose} />
        </Animated.View>

        <View style={styles.bottomSheetContainer}>
          <View style={styles.sheetHandle} />

          <View style={styles.sheetHeader}>
            <View>
              <Text style={styles.sheetTitle}>Connected Storage</Text>
              <Text style={styles.sheetSubtitle}>
                Accounts feeding your virtual storage cluster
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeSheetButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* TWO-ROW SHIMMER SKELETON */}
          {isFetchingAccounts ? (
            <View style={styles.sheetSkeletonContainer}>
              <View style={styles.skeletonRowWrapper}>
                <Animated.View
                  style={[styles.skeletonCircle, { opacity: shimmerAlpha }]}
                />
                <View style={{ flex: 1, gap: 8 }}>
                  <Animated.View
                    style={[
                      styles.skeletonBar,
                      { width: "40%", opacity: shimmerAlpha },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.skeletonBar,
                      { width: "65%", opacity: shimmerAlpha },
                    ]}
                  />
                </View>
                <Animated.View
                  style={[
                    styles.skeletonBar,
                    { width: 45, opacity: shimmerAlpha },
                  ]}
                />
              </View>
              <View style={[styles.skeletonRowWrapper, { marginTop: 16 }]}>
                <Animated.View
                  style={[styles.skeletonCircle, { opacity: shimmerAlpha }]}
                />
                <View style={{ flex: 1, gap: 8 }}>
                  <Animated.View
                    style={[
                      styles.skeletonBar,
                      { width: "35%", opacity: shimmerAlpha },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.skeletonBar,
                      { width: "55%", opacity: shimmerAlpha },
                    ]}
                  />
                </View>
                <Animated.View
                  style={[
                    styles.skeletonBar,
                    { width: 45, opacity: shimmerAlpha },
                  ]}
                />
              </View>
            </View>
          ) : (
            /* MAP NATIVE ACCOUNTS DYNAMICALLY */
            <View style={styles.accountListContainer}>
              {accounts.map((account) => (
                <View key={account.id} style={styles.nodeItemRow}>
                  <View style={styles.nodeItemLeft}>
                    <View
                      style={[
                        styles.brandIconWrapper,
                        { backgroundColor: "#E0F2FE" },
                      ]}
                    >
                      <Ionicons
                        name={"logo-google"}
                        size={18}
                        color={"#2563EB"}
                      />
                    </View>
                    <View style={styles.nodeTextDetailsFrame}>
                      <Text style={styles.nodeTitleText}>
                        {account.displayName || "Google Drive"}
                      </Text>
                      <Text style={styles.nodeMetaText} numberOfLines={1}>
                        {account.email}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.nodeItemRight}>
                    <Text style={styles.nodeSizeText}>
                      {parseFloat(
                        (
                          parseInt(account.quotaUsedBytes ?? "0") /
                          1024 ** 3
                        ).toFixed(2),
                      )}{" "}
                      GB
                    </Text>
                    <Text style={styles.nodeTotalSizeText}>
                      {" "}
                      /{" "}
                      {parseFloat(
                        (
                          parseInt(account.quotaTotalBytes ?? "0") /
                          1024 ** 3
                        ).toFixed(2),
                      )}{" "}
                      GB
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* <TouchableOpacity style={styles.addNodeButton} activeOpacity={0.75}>
            <Ionicons
              name="add"
              size={16}
              color="#475569"
              style={{ marginRight: 6 }}
            />
            <Text style={styles.addNodeButtonText}>
              Link Another Cloud Account
            </Text>
          </TouchableOpacity> */}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalViewportContainer: { flex: 1, justifyContent: "flex-end" },
  modalBackdropScrim: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.3)",
  },
  scrimDismissArea: { flex: 1 },
  bottomSheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 44 : 32,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 24,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 20,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  closeSheetButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
  },

  sheetSkeletonContainer: {
    paddingVertical: 12,
    height: 140,
    justifyContent: "center",
  },
  skeletonRowWrapper: { flexDirection: "row", alignItems: "center" },
  skeletonCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
    marginRight: 14,
  },
  skeletonBar: { height: 12, backgroundColor: "#F1F5F9", borderRadius: 4 },

  accountListContainer: { marginVertical: 8 },
  nodeItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  nodeItemLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  brandIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  nodeTextDetailsFrame: { flex: 1, paddingRight: 12 },
  nodeTitleText: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  nodeMetaText: { fontSize: 11, color: "#94A3B8", marginTop: 2 },
  nodeItemRight: { flexDirection: "row", alignItems: "baseline" },
  nodeSizeText: { fontSize: 14, fontWeight: "700", color: "#1E293B" },
  nodeTotalSizeText: { fontSize: 11, color: "#94A3B8" },
  addNodeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderStyle: "dashed",
    borderRadius: 16,
    paddingVertical: 15,
    marginTop: 16,
  },
  addNodeButtonText: { fontSize: 13, color: "#475569", fontWeight: "700" },
});
