import { Platform, ToastAndroid, Alert } from "react-native";

/**
 * Globally reusable trigger to show a message safely on any platform
 */
export function showToast(message: string) {
  if (Platform.OS === "android") {
    // Natively uses Android's built-in Toast mechanism
    ToastAndroid.showWithGravity(
      message,
      ToastAndroid.SHORT,
      ToastAndroid.BOTTOM,
    );
  } else {
    // Clean fallback for iOS so the app doesn't crash
    Alert.alert("CloudMesh", message, [{ text: "OK" }]);
  }
}
