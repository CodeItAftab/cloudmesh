import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { connectGoogleDrive } from "../lib/api/drive";
import { getSessionToken } from "../lib/api/api";

const { height } = Dimensions.get("window");

interface FirstAccountSetupProps {
  onAccountAdded: () => void;
}

export function FirstAccountSetupScreen({
  onAccountAdded,
}: FirstAccountSetupProps) {
  const [isLinking, setIsLinking] = useState(false);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    getSessionToken()
      .then(setToken)
      .catch((error) => {
        console.error("Error retrieving session token:", error);
      });
  }, []);

  const handleLinkGoogleDrive = async () => {
    setIsLinking(true);
    try {
      // Your backend authentication Deep Link loop will trigger here
      console.log("Starting Google Drive linking process...");
      const accountId = await connectGoogleDrive(token!);
      console.log(
        "Google Drive linked successfully with accountId:",
        accountId,
      );
      onAccountAdded();
      console.log("onConnected() called");
    } catch (error) {
      console.error(error);
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Structural Network Tracking Header (Fixed Wrapping) */}
      <View style={styles.topNamespace}>
        <Text
          style={styles.namespaceText}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          CLOUDMESH CORE PROTOCOL
        </Text>
      </View>

      {/* 1. Deep-Tech Product Messaging Header */}
      <View style={styles.headerContainer}>
        <Text style={styles.title}>Initialize Storage Pool</Text>
        <Text style={styles.subtitle}>
          To assemble your virtual file network, CloudMesh requires an initial
          storage layer. Connect your Google Drive to map the root directory
          cluster.
        </Text>
      </View>

      {/* 2. Concentric Ring Mapping & Reserved Media Slot */}
      <View style={styles.centerGraphicsContainer}>
        {/* Fine Radial Coordinate Lines */}
        <View style={styles.orbitRingOuter} />
        <View style={styles.orbitRingInner} />

        {/* Clean Image Asset Slot Container */}
        <View style={styles.imageSlotContainer}>
          <Image
            source={require("../../assets/drive-logo.png")}
            style={{ width: 56, height: 56, resizeMode: "contain" }}
          />
          {/* <View style={styles.slotIndicatorBar} /> */}
        </View>

        {/* Dynamic Storage Matrix Labels */}
        <View style={styles.metaLabelGroup}>
          <Text style={styles.metaTitleText}>GOOGLE DRIVE STORAGE NODE</Text>
          <Text style={styles.metaCapacityText}>
            BASE ALLOCATION LAYER: +15.00 GB
          </Text>
        </View>
      </View>

      {/* 3. Action Call / Gateway Dispatch Block */}
      <View style={styles.actionBlock}>
        <TouchableOpacity
          style={[styles.actionButton, isLinking && styles.buttonExecuting]}
          onPress={handleLinkGoogleDrive}
          disabled={isLinking}
          activeOpacity={0.85}
        >
          {isLinking ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <View style={styles.buttonFlex}>
              <Text style={styles.buttonLabel}>Mount Storage Cluster</Text>
              <Ionicons
                name="arrow-forward"
                size={16}
                color="#FFFFFF"
                style={styles.buttonIcon}
              />
            </View>
          )}
        </TouchableOpacity>

        {/* Network Diagnostics Monitor Line */}
        <View style={styles.diagnosticsRow}>
          <View style={styles.statusDotPulse} />
          <Text style={styles.diagnosticsText}>
            SECURE API HANDSHAKE GATEWAY READY
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 32,
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  topNamespace: {
    alignItems: "center",
    marginTop: 12,
    width: "100%",
  },
  namespaceText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#94A3B8",
    letterSpacing: 2, // Slightly adjusted spacing to eliminate edge collisions
    textAlign: "center",
  },
  headerContainer: {
    alignItems: "center",
    marginTop: height * 0.03,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: -0.75,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 22,
    paddingHorizontal: 6,
  },
  centerGraphicsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    marginVertical: 20,
  },
  orbitRingOuter: {
    position: "absolute",
    width: 270,
    height: 270,
    borderRadius: 135,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    borderStyle: "dashed",
  },
  orbitRingInner: {
    position: "absolute",
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 1,
    borderColor: "#F8FAFC",
  },
  imageSlotContainer: {
    width: 80,
    height: 80,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
  },
  slotIndicatorBar: {
    position: "absolute",
    bottom: -1,
    width: 16,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: "#0066FF",
  },
  metaLabelGroup: {
    alignItems: "center",
    marginTop: 34,
    gap: 4,
  },
  metaTitleText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#1E293B",
    letterSpacing: 0.75,
  },
  metaCapacityText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#0066FF",
    letterSpacing: 0.2,
  },
  actionBlock: {
    marginBottom: 16,
    gap: 20,
  },
  actionButton: {
    backgroundColor: "#0F172A",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 2,
  },
  buttonExecuting: {
    backgroundColor: "#64748B",
  },
  buttonFlex: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.1,
  },
  buttonIcon: {
    marginLeft: 6,
    marginTop: 1,
  },
  diagnosticsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  statusDotPulse: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#10B981",
  },
  diagnosticsText: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
