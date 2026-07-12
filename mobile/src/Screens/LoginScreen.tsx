import React from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { showToast } from "../lib/toast";
import { signInWithGoogle } from "../lib/api/auth";

const { width, height } = Dimensions.get("window");

interface LoginScreenProps {
  onSignedIn: () => void;
}

export function LoginScreen({ onSignedIn }: LoginScreenProps) {
  const [loading, setLoading] = React.useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const res = await signInWithGoogle();
      console.log("Google sign-in result:", res);
      if (res.success) {
        onSignedIn();
      } else {
        setLoading(false);
      }
      showToast("Welcome");
    } catch (error) {
      console.error("Google authentication failed:", error);
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Upper Main Brand Container */}
      <View style={styles.brandContainer}>
        <View style={styles.logoPlaceholder}>
          <Image
            source={require("../../assets/icon.png")}
            style={styles.logoImage}
            defaultSource={require("../../assets/icon.png")} // Fallback asset if needed
          />
        </View>
        <Text style={styles.brandTitle}>CloudMesh</Text>
        <Text style={styles.brandSubtitle}>
          Pool your free cloud storage tiers into one secure mesh drive network.
        </Text>
      </View>

      {/* Action/Button Container aligned at the bottom */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleSignIn}
          activeOpacity={0.85}
          disabled={loading} // Disable button while loading
        >
          {/* Circular color block mimicking standard Google branding color space */}
          <View style={styles.googleIconCircle} />
          <Text style={styles.googleButtonText}>
            {loading ? "Authenticating..." : "Continue with Google"}
          </Text>
        </TouchableOpacity>

        <Text style={styles.disclaimerText}>
          By continuing, you authorize CloudMesh to safely organize your storage
          nodes.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    justifyContent: "space-between", // Pushes brand to top, button block to bottom
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  brandContainer: {
    flex: 1,
    justifyContent: "center", // Perfectly centers the brand elements vertically
    alignItems: "center",
  },
  logoPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 28,
    backgroundColor: "#F8FAFC",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  logoImage: { width: "100%", height: "100%", resizeMode: "contain" },
  brandTitle: {
    fontSize: 32,
    fontWeight: "900",
    color: "#0F172A",
    letterSpacing: -0.75,
  },
  brandSubtitle: {
    fontSize: 15,
    color: "#64748B",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 22,
    paddingHorizontal: 12,
  },
  actionContainer: {
    width: "100%",
    alignItems: "center",
    marginBottom: height * 0.02, // Relative padding dependent on viewport height
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A73E8", // Premium Google Blue brand color accent
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: "#1A73E8",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  googleIconCircle: {
    width: 18,
    height: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 9,
    marginRight: 14,
  },
  googleButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  disclaimerText: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 16,
    paddingHorizontal: 20,
  },
});
