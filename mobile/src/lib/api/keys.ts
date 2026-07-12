// ============================================
// Master key sync (server-escrow model)
// ============================================

import { apiFetch } from "./api";

export async function fetchServerMasterKey(): Promise<string | null> {
  const res = await apiFetch("/keys/master");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch master key");
  const data = await res.json();
  return data.masterKeyHex;
}

export async function pushServerMasterKey(masterKeyHex: string): Promise<void> {
  const res = await apiFetch("/keys/master", {
    method: "POST",
    body: JSON.stringify({ masterKeyHex }),
  });
  if (!res.ok) throw new Error("Failed to save master key");
}
