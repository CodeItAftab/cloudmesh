import { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";
import { verifySession } from "../lib/session.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  const token = req.cookies[config.SESSION_COOKIE_NAME];
  const authHeader = req.headers["authorization"];
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : undefined;

  const finalToken = token || bearerToken;

  if (!finalToken) {
    return reply
      .code(401)
      .send({ error: "Unauthorized: No session token provided" });
  }

  const userId = await verifySession(finalToken);

  if (!userId) {
    return reply
      .code(401)
      .send({ error: "Unauthorized: Invalid or expired session token" });
  }

  req.userId = userId;
}
