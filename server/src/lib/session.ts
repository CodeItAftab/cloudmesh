import { createHash, randomBytes } from "node:crypto";
import { config } from "../config.js";
import { db } from "./db.js";

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string; ipAddress?: string },
): Promise<{ rawToken: string; expiresAt: Date }> {
  const rawToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(
    Date.now() + config.SESSION_TTL_DAYS * 24 * 60 * 60 * 1000,
  );

  await db.session.create({
    data: {
      userId,
      sessionTokenHash: hashToken(rawToken),
      userAgent: meta.userAgent,
      ipAddress: meta.ipAddress,
      expiresAt,
    },
  });

  return { rawToken, expiresAt };
}

export async function revokeSession(rawToken: string): Promise<void> {
  await db.session.updateMany({
    where: { sessionTokenHash: hashToken(rawToken) },
    data: { revokedAt: new Date() },
  });
}

export async function verifySession(rawToken: string): Promise<string | null> {
  const session = await db.session.findFirst({
    where: {
      sessionTokenHash: hashToken(rawToken),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!session) {
    return null;
  }

  return session.userId;
}
