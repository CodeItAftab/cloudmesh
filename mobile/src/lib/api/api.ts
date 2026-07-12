import * as SecureStore from "expo-secure-store";

const SESSION_TOKEN_KEY = "cloudmesh_session_token";

export const API_BASE_URL =
  "https://protein-valid-scripts-eyed.trycloudflare.com"; // Replace with your actual API base URL

/*
    Session Token Storage Management:
    - saveSessionToken(token: string): Promise<void>
        Saves the provided session token securely using Expo's SecureStore.
    - getSessionToken(): Promise<string | null>
        Retrieves the session token from secure storage. Returns null if not found.
    - clearSessionToken(): Promise<void>
        Deletes the session token from secure storage.
*/

export async function saveSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
}

export async function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
}

export async function clearSessionToken(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
}

/*
    Core Fetch Wrapper: Attaches the Bearer token to the Authorization header for authenticated requests.
*/

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getSessionToken();

  // 🟢 Initialize headers object safely
  const headers: Record<string, string> = {};

  // Copy over any existing headers passed in options
  if (options.headers) {
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      options.headers.forEach(([key, value]) => {
        headers[key] = value;
      });
    } else {
      Object.assign(headers, options.headers);
    }
  }

  // 🟢 Bypasses common cloudflare / tunnel proxy landing screens
  headers["ngrok-skip-browser-warning"] = "true";
  headers["User-Agent"] = "CloudMeshMobile/1.0";

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (options.body) {
    headers["Content-Type"] = "application/json";
  }

  const url = `${API_BASE_URL}${path}`;

  console.log(`📡 Outbound API Request: ${options.method || "GET"} -> ${url}`);
  console.log(`🔑 Outbound Auth Token Present: ${!!token}`);

  const response = await fetch(url, {
    ...options,
    headers, // Pass the plain object directly
  });

  console.log(`📥 Inbound API Response Status [${path}]:`, response.status);

  return response;
}
