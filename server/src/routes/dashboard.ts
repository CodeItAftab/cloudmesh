import type { FastifyInstance } from "fastify";
import { db } from "../lib/db.js";
import { requireAuth } from "../middlewares/requireAuth.js";

export async function dashboardRoutes(app: FastifyInstance) {
  app.get("/stats", { preHandler: requireAuth }, async (req, reply) => {
    const userId = req.userId!;

    const accounts = await db.connectedAccount.findMany({
      where: { userId, status: "ACTIVE" },
      select: {
        quotaTotalBytes: true,
        quotaUsedBytes: true,
        email: true,
        status: true,
        displayName: true,
        id: true,
      },
    });

    const totalQuota = accounts.reduce(
      (sum, a) => sum + (a.quotaTotalBytes ?? BigInt(0)),
      BigInt(0),
    );

    const usedQuota = accounts.reduce(
      (sum, a) => sum + (a.quotaUsedBytes ?? BigInt(0)),
      BigInt(0),
    );

    // Connected accounts

    return reply.send({
      totalQuotaBytes: totalQuota.toString(),
      usedQuotaBytes: usedQuota.toString(),
      availableQuotaBytes: (totalQuota - usedQuota).toString(),
      accountCount: accounts.length,
      accounts: accounts.map((a) => ({
        id: a.id,
        displayName: a.displayName,
        email: a.email,
        status: a.status,
        quotaTotalBytes: a.quotaTotalBytes?.toString() ?? null,
        quotaUsedBytes: a.quotaUsedBytes?.toString() ?? null,
      })),
    });
  });
}
