import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import NetInfo from "@react-native-community/netinfo";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { initUploadDb } from "./src/lib/upload/uploadDb";

import { processUploadQueue } from "./src/lib/upload/uploadRunner";
import { useUploadUIStore } from "./src/lib/upload/uploadUIStore";
export default function App() {
  useEffect(() => {
    async function initializeSystem() {
      await initUploadDb();
      await processUploadQueue();
    }

    initializeSystem();

    // Catch connection changes and recover paused transfers instantly
    const unsubscribeNet = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        processUploadQueue();
      }
    });

    // Simple 1-second automated heartbeat to sweep and synchronize active states
    const uiInterval = setInterval(async () => {
      const isUploading = await useUploadUIStore.getState().syncUIStats();
      if (isUploading) {
        processUploadQueue();
      }
    }, 1000);

    return () => {
      unsubscribeNet();
      clearInterval(uiInterval);
    };
  }, []);

  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
