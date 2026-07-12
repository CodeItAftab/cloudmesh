import type { FastifyInstance, FastifyReply } from "fastify";
import { config } from "../config.js";
import { db } from "../lib/db.js";
import {
  exchangeCodeForTokens,
  SIGNIN_SCOPES,
  signInOAuthClient,
} from "../lib/google.js";
import { generateRandomState } from "../lib/helper.js";
import { createSession, revokeSession } from "../lib/session.js";

function failAndRedirect(
  reply: FastifyReply,
  errorCode: string,
  message: string,
  httpStatus: number = 400,
  mobileRedirectUri: string | undefined,
) {
  reply.clearCookie("oauth_state");
  reply.clearCookie("oauth_platform");
  reply.clearCookie("oauth_mobile_redirect_uri");

  if (!mobileRedirectUri) {
    return reply.code(httpStatus).send({ error: "oauth_error", message });
  }

  const separator = mobileRedirectUri.includes("?") ? "&" : "?";
  const params = new URLSearchParams({
    error: errorCode,
    message,
  }).toString();

  return reply.redirect(`${mobileRedirectUri}${separator}${params}`);
}

export async function authRoutes(app: FastifyInstance) {
  app.get("/auth/google/start", async (req, reply) => {
    const client = signInOAuthClient();
    const { platform, mobileRedirectUri } = req.query as {
      platform?: string;
      mobileRedirectUri?: string;
    };

    const state = generateRandomState();

    reply.setCookie("oauth_state", state, {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 10, // 10 minutes
    });

    reply.setCookie(
      "oauth_platform",
      platform === "mobile" ? "mobile" : "web",
      {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 10, // 10 minutes
      },
    );

    if (mobileRedirectUri) {
      reply.setCookie("oauth_mobile_redirect_uri", mobileRedirectUri, {
        httpOnly: true,
        secure: config.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 10, // 10 minutes
      });
    }

    const authURL = client.generateAuthUrl({
      access_type: "online",
      scope: SIGNIN_SCOPES,
      state: state,
      prompt: "select_account",
    });

    return reply.redirect(authURL);
  });

  app.get("/auth/google/callback", async (req, reply) => {
    const query = req.query as { code?: string; state?: string };
    const cookieState = req.cookies["oauth_state"];
    const platform = req.cookies["oauth_platform"] || "web";
    const mobileRedirectUri = req.cookies["oauth_mobile_redirect_uri"];

    if (!query.code || !query.state || query.state !== cookieState) {
      if (platform === "mobile") {
        return failAndRedirect(
          reply,
          "invalid_state",
          "Invalid state or missing code",
          400,
          mobileRedirectUri,
        );
      }
      return reply.status(400).send({ error: "Invalid state or missing code" });
    }

    const client = signInOAuthClient();

    const { identity } = await exchangeCodeForTokens(client, query.code);

    const existing = await db.providerIdentity.findUnique({
      where: {
        provider_providerSub: {
          provider: "GOOGLE",
          providerSub: identity.sub,
        },
      },
    });

    let userId: string;

    if (!existing) {
      // 1. Check if a user with this email already exists
      const existingUserByEmail = await db.user.findUnique({
        where: { primaryEmail: identity.email },
      });

      if (existingUserByEmail) {
        // 2. Account linking: User exists, so link this new provider identity to them
        await db.providerIdentity.create({
          data: {
            provider: "GOOGLE",
            providerSub: identity.sub,
            email: identity.email,
            role: "PRIMARY", // Adjust role logic if 'PRIMARY' is reserved for the original signup
            userId: existingUserByEmail.id,
          },
        });

        userId = existingUserByEmail.id;

        // Optionally update their profile details/last login
        await db.user.update({
          where: { id: userId },
          data: { lastLoginAt: new Date() },
        });
      } else {
        // 3. Brand new user: Neither email nor identity exists
        const user = await db.user.create({
          data: {
            primaryEmail: identity.email,
            googleSub: identity.sub,
            displayName: identity.name,
            avatarUrl: identity.picture,
            lastLoginAt: new Date(),
          },
        });

        await db.providerIdentity.create({
          data: {
            provider: "GOOGLE",
            providerSub: identity.sub,
            email: identity.email,
            role: "PRIMARY",
            userId: user.id,
          },
        });

        userId = user.id;
      }
    } else if (existing.role === "CONNECTED_STORAGE") {
      if (platform === "mobile") {
        return failAndRedirect(
          reply,
          "google_account_already_connected_as_storage",
          "This Google account is already linked as storage on another account. Try a different one.",
          403,
          mobileRedirectUri,
        );
      }
      return reply.code(403).send({
        error:
          "This Google account is already connected to a storage provider. Please use a different Google account.",
      });
    } else {
      if (!existing.userId) {
        if (platform === "mobile") {
          return failAndRedirect(
            reply,
            "corrupt_identity_record",
            "Something went wrong on our end. Please try again.",
            500,
            mobileRedirectUri,
          );
        }
        return reply.code(500).send({
          error: "Corrupt identity record: missing userId",
        });
      }

      userId = existing.userId;
      await db.user.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
      });
    }

    const { rawToken, expiresAt } = await createSession(userId, {
      userAgent: req.headers["user-agent"],
      ipAddress: req.ip,
    });

    reply.clearCookie("oauth_state");
    reply.clearCookie("oauth_platform");
    reply.clearCookie("oauth_mobile_redirect_uri");

    if (platform === "mobile") {
      if (!mobileRedirectUri) {
        return reply.code(400).send({ error: "Missing mobile redirect URI" });
      }

      const separator = mobileRedirectUri.includes("?") ? "&" : "?";
      const deepLink = `${mobileRedirectUri}${separator}token=${rawToken}`;
      return reply.redirect(deepLink);
    }

    reply.setCookie(config.SESSION_COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: config.NODE_ENV === "production",
      sameSite: "lax",
      expires: expiresAt,
      path: "/",
    });

    return reply.send({
      success: true,
    });
  });

  app.post("/auth/logout", async (req, reply) => {
    const token = req.cookies[config.SESSION_COOKIE_NAME];
    if (token) {
      await revokeSession(token);
      reply.clearCookie(config.SESSION_COOKIE_NAME);
    }
    return reply.send({ success: true });
  });
}
