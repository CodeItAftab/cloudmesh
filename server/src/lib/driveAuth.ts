import { OAuth2Client } from "google-auth-library";
import { db } from "./db.js";
import { config } from "../config.js";
import { encryptToken, decryptToken } from "./crypto.js";

export async function getValidAccessToken(accountId: string): Promise<string> {
  const account = await db.connectedAccount.findUniqueOrThrow({
    where: { id: accountId },
  });

  const stillValid =
    account?.accessTokenEncrypted &&
    account?.tokenExpiry &&
    account.tokenExpiry.getTime() > Date.now() + 60_000; // 1 minute buffer

  if (stillValid) {
    const tokenBuffer = Buffer.from(account.accessTokenEncrypted!);
    return decryptToken(tokenBuffer);
  }

  //   If the access token is not valid or has expired, we need to refresh it using the refresh token.

  const refreshToken = decryptToken(Buffer.from(account.refreshTokenEncrypted));

  const client = new OAuth2Client({
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
  });

  client.setCredentials({ refresh_token: refreshToken });

  try {
    const { credentials } = await client.refreshAccessToken();
    if (!credentials.access_token) {
      throw new Error("Failed to refresh access token.");
    }

    await db.connectedAccount.update({
      where: { id: accountId },
      data: {
        accessTokenEncrypted: Uint8Array.from(
          encryptToken(credentials.access_token),
        ),
        tokenExpiry: credentials.expiry_date
          ? new Date(credentials.expiry_date)
          : null,
      },
    });

    return credentials.access_token;
  } catch (error) {
    // Refresh failing usually means the user has revoked access from Google's side.
    await db.connectedAccount.update({
      where: { id: accountId },
      data: {
        status: "REVOKED",
      },
    });

    throw new Error(
      `Account ${accountId} has been revoked. Please reconnect your Google account.`,
    );
  }
}
