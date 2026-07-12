import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../lib/db.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { encryptToken, decryptToken } from "../lib/crypto.js";

const setKeySchema = z.object({
  masterKeyHex: z.string().min(1),
});

export async function keyRoutes(app: FastifyInstance) {
  // Called once, by whichever device first generates the master key.
  // Idempotent-safe: if another device already set one, we do NOT
  // overwrite it -- same multi-device-safety principle as before.
  app.post("/keys/master", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = setKeySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }
    const userId = req.userId!;

    const existing = await db.userMasterKey.findUnique({ where: { userId } });
    if (existing) {
      return reply.send({ success: true, alreadyExisted: true });
    }

    const encryptedKey = Uint8Array.from(
      encryptToken(parsed.data.masterKeyHex),
    );
    await db.userMasterKey.create({ data: { userId, encryptedKey } });

    return reply.send({ success: true, alreadyExisted: false });
  });

  // Called by any device on login to get the key -- no recovery code needed.
  app.get("/keys/master", { preHandler: requireAuth }, async (req, reply) => {
    const record = await db.userMasterKey.findUnique({
      where: { userId: req.userId! },
    });
    if (!record) {
      return reply
        .code(404)
        .send({ error: "No master key set for this user yet" });
    }

    const masterKeyHex = decryptToken(Buffer.from(record.encryptedKey));
    return reply.send({ masterKeyHex });
  });
}
