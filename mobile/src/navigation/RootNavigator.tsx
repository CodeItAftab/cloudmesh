// src/navigation/RootNavigator.tsx
import { useEffect, useState } from "react";
import * as SplashScreen from "expo-splash-screen";
import { Text, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { OnboardingScreen } from "../Screens/Onboarding/OnboardingScreen";
import { AuthNavigator } from "./AuthNavigator";
import { FirstAccountSetupScreen } from "../Screens/FirstAccountSetupScreen";
import { MainTabNavigator } from "./MainTabNavigator";
import { hasSeenOnboarding, markOnboardingSeen } from "../lib/onboarding";
import { getCurrentUser } from "../lib/api/auth";
import { listConnectedAccounts } from "../lib/api/drive";
import { fetchServerMasterKey, pushServerMasterKey } from "../lib/api/keys";
import { syncMasterkey } from "../lib/keyManager";

type BootstrapState =
  | { status: "checking" | "onboarding" | "needsFirstAccount" | "loggedOut" }
  | { status: "ready"; usersId: string };

SplashScreen.preventAutoHideAsync().catch(() => {});

const Stack = createNativeStackNavigator();

// --- Simulated API endpoints ---
// const getCurrentUser = async (): Promise<string | null> => {
//   return new Promise((resolve) => setTimeout(() => resolve(null), 100));
// };

// const hasSeenOnboarding = async (): Promise<boolean> => {
//   return new Promise((resolve) => setTimeout(() => resolve(true), 1000));
// };

// const listConnectedAccounts = async (): Promise<string[]> => {
//   return new Promise((resolve) => setTimeout(() => resolve([]), 2000));
// };

export function RootNavigator() {
  const [state, setState] = useState<BootstrapState>({ status: "checking" });

  async function RunCheck() {
    try {
      const seenOnboarding = await hasSeenOnboarding();
      if (!seenOnboarding) {
        setState({ status: "onboarding" });
        return;
      }

      const user = await getCurrentUser();
      if (!user) {
        setState({ status: "loggedOut" });
        return;
      }

      const masterKey = await syncMasterkey(
        fetchServerMasterKey,
        pushServerMasterKey,
      );
      console.log("Master key synced:", masterKey);

      const connectedAccounts = await listConnectedAccounts();
      if (connectedAccounts.length === 0) {
        setState({ status: "needsFirstAccount" });
        return;
      }

      setState({ status: "ready", usersId: user.userId });
    } catch (err) {
      console.error("Error during bootstrap check:", err);
      setState({ status: "loggedOut" });
    }
  }

  async function handleOnboardingDone() {
    await markOnboardingSeen();
    RunCheck();
  }

  useEffect(() => {
    RunCheck();
  }, []);

  useEffect(() => {
    if (state.status !== "checking") {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [state.status]);

  if (state.status === "checking") return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* 🟢 THE FIX: Top-Level Stack Branching Architecture */}

        {state.status === "onboarding" && (
          <Stack.Screen name="OnboardingFlow">
            {(props) => (
              <OnboardingScreen {...props} onDone={handleOnboardingDone} />
            )}
          </Stack.Screen>
        )}

        {state.status === "loggedOut" && (
          <Stack.Screen name="AuthFlow">
            {(props) => <AuthNavigator {...props} onSignedIn={RunCheck} />}
          </Stack.Screen>
        )}

        {state.status === "needsFirstAccount" && (
          <Stack.Screen name="FirstAccountSetup">
            {() => <FirstAccountSetupScreen onAccountAdded={RunCheck} />}
          </Stack.Screen>
        )}

        {state.status === "ready" && (
          <Stack.Screen name="MainApp">
            {() => <MainTabNavigator />}
          </Stack.Screen>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
