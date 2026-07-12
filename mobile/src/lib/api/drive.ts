import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { API_BASE_URL, apiFetch } from "./api";

WebBrowser.maybeCompleteAuthSession();

export interface ConnectedAccount {
  id: string;
  displayName: string;
  email: string;
  status: string;
  quotaTotalBytes: string | null;
  quotaUsedBytes: string | null;
}

export interface DashboardData {
  totalQuotaBytes: string;
  usedQuotaBytes: string;
  availableQuotaBytes: string;
  accountCount: number;
  accounts: ConnectedAccount[];
  // fileCount: number;
  // folderCount: number;
  // recentFiles: {
  //   id: string;
  //   filename: string;
  //   sizeBytes: string;
  //   mimeType: string | null;
  //   status: string;
  //   updatedAt: string;
  // }[];
}

// export async function connectGoogleDrive(): Promise<string> {
//   const redirectUri = Linking.createURL("connect-callback");
//   const token = await getSessionToken();

//   if (!token) {
//     throw new Error("Must be logged in to connect Google Drive");
//   }

//   const startUrl =
//     `${API_BASE_URL}/accounts/google/start` +
//     `?mobileRedirectUri=${encodeURIComponent(redirectUri)}` +
//     `&sessionToken=${encodeURIComponent(token)}`;

//   console.log("startUrl:", startUrl);

//   const result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUri);
//   console.log("WebBrowser result:", JSON.stringify(result));
//   console.log("redirectUri:", redirectUri);

//   if (result.type !== "success" || !result.url) {
//     throw new Error(
//       `Account connection was cancelled or did not complete (type=${result.type})`,
//     );
//   }

//   const { queryParams } = Linking.parse(result.url);
//   const accountId = queryParams?.accountId;

//   if (!accountId || typeof accountId !== "string") {
//     throw new Error("Account connection failed: missing accountId");
//   }

//   return accountId;
// }

export async function connectGoogleDrive(token: string): Promise<string> {
  const redirectUri = Linking.createURL("connect-callback");

  if (!token) {
    throw new Error("Must be logged in to connect Google Drive");
  }

  const startUrl =
    `${API_BASE_URL}/accounts/google/start` +
    `?mobileRedirectUri=${encodeURIComponent(redirectUri)}` +
    `&sessionToken=${encodeURIComponent(token)}`;

  console.log("Generated Redirect URI:", redirectUri);
  console.log("Full Start URL:", startUrl);

  const result = await WebBrowser.openAuthSessionAsync(startUrl, redirectUri);
  console.log("WebBrowser closed with result:", JSON.stringify(result));

  if (result.type !== "success" || !result.url) {
    throw new Error(
      `Account connection was cancelled or did not complete (type=${result.type})`,
    );
  }

  const { queryParams } = Linking.parse(result.url);
  const accountId = queryParams?.accountId;

  if (!accountId || typeof accountId !== "string") {
    throw new Error("Account connection failed: missing accountId");
  }

  return accountId;
}

export async function listConnectedAccounts(): Promise<ConnectedAccount[]> {
  const res = await apiFetch("/accounts");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Failed to list connected accounts: ${res.status} ${res.statusText} - ${body}`,
    );
  }
  const data = await res.json();
  return Array.isArray(data) ? data : (data.accounts ?? []);
}

export async function getDashboardStats(): Promise<DashboardData> {
  const res = await apiFetch("/stats");
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Failed to fetch dashboard stats: ${res.status} ${res.statusText} - ${body}`,
    );
  }

  const data = await res.json();
  return data;
}
