/*
 * Auth API Module
 */
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import {
  API_BASE_URL,
  apiFetch,
  getSessionToken,
  saveSessionToken,
} from "./api";
import { Alert } from "react-native";

export interface AuthResult {
  success: boolean;
  errorReason?: string;
}

WebBrowser.maybeCompleteAuthSession();

export async function signInWithGoogle(): Promise<{ success: boolean }> {
  const redirectUri = Linking.createURL("auth-callback");

  const startUrl =
    `${API_BASE_URL}/auth/google/start?platform=mobile` +
    `&mobileRedirectUri=${encodeURIComponent(redirectUri)}`;

  const result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUri);
  console.log("Auth session result:", result);

  if (result.type !== "success" || !result.url) {
    Alert.alert("Sign-in failed", "Sign-in was cancelled or did not complete.");
    return { success: false };
    // throw new Error("Sign-in was cancelled or did not complete");
  }

  const { queryParams } = Linking.parse(result.url);

  if (queryParams?.error) {
    const rawMessage =
      typeof queryParams.message === "string"
        ? queryParams.message
        : "Sign-in failed. Please try again.";

    // Query params were built with URLSearchParams, which encodes
    // spaces as "+" rather than "%20" — decode those back to spaces.
    const message = rawMessage.replace(/\+/g, " ");

    // Alert.alert called the instant the auth browser closes can fail
    // silently (no active window yet, especially on iOS). Deferring
    // to the next tick lets the app finish coming back to the foreground.
    setTimeout(() => {
      Alert.alert("Sign-in failed", message);
    }, 300);

    return { success: false };
  }

  const token = queryParams?.token;

  if (!token || typeof token !== "string") {
    setTimeout(() => {
      Alert.alert(
        "Sign-in failed",
        "No session token returned. Please try again.",
      );
    }, 300);
    return { success: false };
  }

  await saveSessionToken(token);

  return { success: true };
}
export async function getCurrentUser(): Promise<{ userId: string } | null> {
  const token = await getSessionToken();
  if (!token) return null;

  const res = await apiFetch("/me");
  if (!res.ok) return null;
  return res.json();
}

export async function logoutOnServer(): Promise<void> {
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch (error) {
    console.error("Error during logout:", error);
  }
}
