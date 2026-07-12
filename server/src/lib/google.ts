import "dotenv/config";
import { OAuth2Client } from "google-auth-library";
import { config } from "../config.js";

export const SIGNIN_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
];

export const CONNECT_STORAGE_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/drive.file",
];

export interface VerifiedGoogleIdentity {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export function signInOAuthClient() {
  return new OAuth2Client({
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    redirectUri: config.GOOGLE_REDIRECT_URI_SIGNIN,
  });
}

export function connectStorageOAuthClient() {
  return new OAuth2Client({
    clientId: config.GOOGLE_CLIENT_ID,
    clientSecret: config.GOOGLE_CLIENT_SECRET,
    redirectUri: config.GOOGLE_REDIRECT_URI_CONNECT,
  });
}

export async function exchangeCodeForTokens(
  client: OAuth2Client,
  code: string,
): Promise<{
  identity: VerifiedGoogleIdentity;
  tokens: {
    refreshToken?: string;
    accessToken?: string;
    expiryData: number;
  };
}> {
  const { tokens } = await client.getToken(code);
  if (!tokens.id_token) {
    throw new Error("No ID token returned from Google");
  }

  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: config.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.sub || !payload.email) {
    throw new Error("Invalid Google ID token payload");
  }

  return {
    identity: {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
    },
    tokens: {
      refreshToken: tokens.refresh_token ?? undefined,
      accessToken: tokens.access_token ?? undefined,
      expiryData: tokens.expiry_date ?? 0,
    },
  };
}
