import { FastifyInstance } from "fastify";
import { verifySession } from "../lib/session.js";
import {
  CONNECT_STORAGE_SCOPES,
  connectStorageOAuthClient,
  exchangeCodeForTokens,
} from "../lib/google.js";
import { generateRandomState } from "../lib/helper.js";
import { config } from "../config.js";
import { db } from "../lib/db.js";
import { encryptToken } from "../lib/crypto.js";
import { createAppFolder, getDriveQuota } from "../lib/drive.js";
import { requireAuth } from "../middlewares/requireAuth.js";

export async function driveRoutes(app: FastifyInstance) {
  // Step 1: logged-in user clicks "Connect a Google account" -> redirect to consent screen.
  app.get("/accounts/google/start", async (req, reply) => {
    // Manually verify here instead of using requireAuth's preHandler,
    // since this route accepts the token via query param (browser
    // navigation, not a fetch call that could set a header).

    const { mobileRedirectUri, sessionToken } = req.query as {
      mobileRedirectUri?: string;
      sessionToken?: string;
    };

    if (!sessionToken) {
      return reply
        .status(400)
        .send({ error: "Missing sessionToken query parameter." });
    }

    const userId = await verifySession(sessionToken);
    if (!userId) {
      return reply
        .status(401)
        .send({ error: "Invalid or expired session token." });
    }

    const client = connectStorageOAuthClient();

    const state = generateRandomState(16);
    reply.setCookie("connect_oauth_state", state, {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60, // 10 minutes
    });
    // Store the userId in a cookie as well, so we can retrieve it later in the callback.
    reply.setCookie("connect_user_id", userId, {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 10 * 60, // 10 minutes
    });

    if (mobileRedirectUri) {
      reply.setCookie("connect_mobile_redirect_uri", mobileRedirectUri, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 10 * 60, // 10 minutes
      });
    }

    const url = client.generateAuthUrl({
      access_type: "offline",
      scope: CONNECT_STORAGE_SCOPES,
      state: state,
      prompt: "consent", // Force consent screen to ensure we get a refresh token
    });

    return reply.redirect(url);
  });

  // Step 2: Google redirects back here after the user approves.

  app.get("/accounts/google/callback", async (req, reply) => {
    const query = req.query as {
      code?: string;
      state?: string;
    };
    const cookieState = req.cookies["connect_oauth_state"];
    const currentUserId = req.cookies["connect_user_id"];
    if (!currentUserId) {
      return reply.status(400).send({ error: "Missing user ID cookie." });
    }

    if (!query.code || !query.state || query.state !== cookieState) {
      return reply
        .status(400)
        .send({ error: "Invalid or missing state parameter." });
    }

    const client = connectStorageOAuthClient();

    const { identity, tokens } = await exchangeCodeForTokens(
      client,
      query.code,
    );

    if (!tokens.refreshToken) {
      return reply.status(400).send({
        error:
          "No refresh token returned from Google. Please ensure you are granting offline access.",
      });
    }

    const existing = await db.providerIdentity.findUnique({
      where: {
        provider_providerSub: {
          provider: "GOOGLE",
          providerSub: identity.sub,
        },
      },
    });

    // if the existing identity is PRIMARY and belongs to a different user, we should not allow connecting it as storage for the current user.
    if (
      existing &&
      existing.role === "PRIMARY" &&
      existing.userId !== currentUserId
    ) {
      return reply.status(403).send({
        error:
          "This Google account is already registered as a login for a different user and can't be connected as storage.",
      });
    }

    // if the existing identity is CONNECTED_STORAGE and belongs to a different user, we should not allow connecting it as storage for the current user.
    if (
      existing &&
      existing.role === "CONNECTED_STORAGE" &&
      existing.userId !== currentUserId
    ) {
      return reply.status(403).send({
        error: "This Google account is already connected to a different user.",
      });
    }

    // If the identity doesn't exist, create it as CONNECTED_STORAGE for the current user.
    if (!existing) {
      await db.providerIdentity.create({
        data: {
          provider: "GOOGLE",
          providerSub: identity.sub,
          email: identity.email,
          role: "CONNECTED_STORAGE",
          userId: currentUserId,
        },
      });
    }

    // If the identity exists and belongs to the current user, we can proceed to store the refresh token and access token.
    const existingAccount = await db.connectedAccount.findFirst({
      where: {
        userId: currentUserId,
        email: identity.email,
      },
    });

    const encryptedRefreshToken = Uint8Array.from(
      encryptToken(tokens.refreshToken),
    );
    const encryptedAccessToken = tokens.accessToken
      ? Uint8Array.from(encryptToken(tokens.accessToken))
      : null;

    const tokenExpiry = tokens.expiryData ? new Date(tokens.expiryData) : null;

    let accountId = existingAccount?.id;

    // If the account already exists, update it; otherwise, create a new connected account.
    if (existingAccount) {
      await db.connectedAccount.update({
        where: { id: existingAccount.id },
        data: {
          refreshTokenEncrypted: encryptedRefreshToken,
          accessTokenEncrypted: encryptedAccessToken,
          tokenExpiry: tokenExpiry,
          status: "ACTIVE",
          disconnectedAt: null,
        },
      });
    } else {
      const created = await db.connectedAccount.create({
        data: {
          userId: currentUserId,
          displayName: identity.name || "Google Account",
          email: identity.email,
          refreshTokenEncrypted: encryptedRefreshToken,
          accessTokenEncrypted: encryptedAccessToken,
          tokenExpiry: tokenExpiry,
          status: "ACTIVE",
        },
      });
      accountId = created.id;
    }

    // Set up the app folder + fetch initial quota information for the connected account.
    if (tokens.accessToken) {
      const rootFolderId = await createAppFolder(tokens.accessToken);
      const quota = await getDriveQuota(tokens.accessToken);
      await db.connectedAccount.update({
        where: { id: accountId },
        data: {
          rootFolderId: rootFolderId,
          quotaTotalBytes: quota.total,
          quotaUsedBytes: quota.used,
          quotaSyncedAt: new Date(),
        },
      });
    }

    const mobileRedirectUri = req.cookies["connect_mobile_redirect_uri"];

    reply.clearCookie("connect_oauth_state");
    reply.clearCookie("connect_user_id");
    reply.clearCookie("connect_mobile_redirect_uri");

    if (mobileRedirectUri) {
      const cleanUri = mobileRedirectUri.trim();
      const separator = mobileRedirectUri.includes("?") ? "&" : "?";
      const finalRedirectUri = `${cleanUri}${separator}accountId=${accountId}`;
      return reply.redirect(finalRedirectUri);
    }

    return reply.send({ success: true, accountId: accountId });
  });

  app.get("/accounts", { preHandler: requireAuth }, async (req, reply) => {
    const accounts = await db.connectedAccount.findMany({
      where: { userId: req.userId!, status: { not: "DISCONNECTING" } },
      select: {
        id: true,
        displayName: true,
        email: true,
        status: true,
        quotaTotalBytes: true,
        quotaUsedBytes: true,
        quotaSyncedAt: true,
        connectedAt: true,
      },
    });

    return accounts;
  });
}
