import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { config } from "./config.js";

import { authRoutes } from "./routes/auth.js";
import { driveRoutes } from "./routes/drive.js";
import { dashboardRoutes } from "./routes/dashboard.js";
import { foldersRoutes } from "./routes/folders.js";
import { filesRoutes } from "./routes/files.js";
import { keyRoutes } from "./routes/keys.js";

import { requireAuth } from "./middlewares/requireAuth.js";

(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

const app = Fastify({
  logger: true,
});

await app.register(cookie);

// Register routes
await app.register(authRoutes);
await app.register(driveRoutes);
await app.register(dashboardRoutes);
await app.register(foldersRoutes);
await app.register(filesRoutes);
await app.register(keyRoutes);

app.get("/health", async () => ({
  status: "ok",
  time: new Date().toISOString(),
}));

app.get("/me", { preHandler: requireAuth }, async (req, reply) => {
  return reply.send({ userId: req.userId || null });
});

app.listen({ port: config.PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
