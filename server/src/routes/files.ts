import type { FastifyInstance } from "fastify";
import { randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../lib/db.js";
import { requireAuth } from "../middlewares/requireAuth.js";
import { CHUNK_SIZE_BYTES, planChunksBatch } from "../lib/chunk.js";
import { getValidAccessToken } from "../lib/driveAuth.js";
import { buildDownloadUrl, initResumableUploadSession } from "../lib/drive.js";

const initUploadSchema = z.object({
  folderId: z.string().uuid().nullable().optional(), // Applies to all files in this request
  files: z
    .array(
      z.object({
        tempId: z.string().min(1),
        filename: z.string().min(1).max(500),
        sizeBytes: z.number().int().positive(),
        mimeType: z.string().optional(),
      }),
    )
    .min(1)
    .max(10),
});

export async function filesRoutes(app: FastifyInstance) {
  // --- Step 1: Client asks to start an upload, gets back a chunk plan ---
  app.post(
    "/files/upload/init",
    { preHandler: requireAuth },
    async (req, reply) => {
      const parsed = initUploadSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      //   Extract folderId and files from the parsed request body
      const { folderId, files } = parsed.data;
      const userId = req.userId!;

      //   Validate the single folder target upfornt if provided

      if (folderId) {
        const foundFolder = await db.folder.findFirst({
          where: {
            id: folderId,
            userId,
            deletedAt: null,
          },
          select: {
            id: true,
          },
        });

        if (!foundFolder) {
          return reply.status(404).send({ error: "Folder not found" });
        }
      }

      const { planned, failed } = await planChunksBatch(
        userId,
        files.map((f) => ({ tempId: f.tempId, sizeBytes: f.sizeBytes })),
      );

      const plannedByTempId = new Map(planned.map((p) => [p.tempId, p.chunks]));
      const results = [];

      //
      for (const fileInput of files) {
        const plan = plannedByTempId.get(fileInput.tempId);
        if (!plan) continue; // Skip if no plan was found for this file

        // All files inherit the single root folderId
        const file = await db.file.create({
          data: {
            userId,
            folderId: folderId ?? null,
            filename: fileInput.filename,
            sizeBytes: BigInt(fileInput.sizeBytes),
            mimeType: fileInput.mimeType ?? null,
            status: "UPLOADING",
            encryptionIv: randomBytes(32).toString("base64"),
            encryptionKeyRef: randomUUID(),
          },
        });

        await db.uploadSession.create({
          data: {
            fileId: file.id,
            userId,
            status: "IN_PROGRESS",
            expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour from now
          },
        });

        const manifestChunks = [];
        for (const p of plan) {
          const chunk = await db.chunk.create({
            data: {
              fileId: file.id,
              chunkIndex: p.chunkIndex,
              byteOffset: BigInt(p.byteOffset),
              sizeBytes: p.sizeBytes,
              accountId: p.accountId,
              status: "PLANNED",
            },
          });

          const account = await db.connectedAccount.findUniqueOrThrow({
            where: { id: p.accountId },
          });

          const accessToken = await getValidAccessToken(p.accountId);
          const uploadUrl = await initResumableUploadSession(
            accessToken,
            account.rootFolderId!,
            `chunk-${chunk.id}`,
            p.sizeBytes,
          );

          manifestChunks.push({
            chunkId: chunk.id,
            chunkIndex: chunk.chunkIndex,
            byteOffset: chunk.byteOffset,
            sizeBytes: chunk.sizeBytes,
            uploadUrl,
            authMode: "none" as const,
          });
        }
        results.push({
          tempId: fileInput.tempId,
          fileId: file.id,
          encryptionIv: file.encryptionIv,
          chunkSizeBytes: CHUNK_SIZE_BYTES,
          chunks: manifestChunks,
        });
      }

      return reply.status(200).send({ files: results, failed });
    },
  );

  app.post(
    "/files/chunks/:chunkId/complete",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { chunkId } = req.params as { chunkId: string };
      const body = req.body as { providerFileId: string; checksum?: string };

      const chunk = await db.chunk.findUnique({
        where: { id: chunkId },
        include: { file: true },
      });

      if (!chunk || chunk.file.userId !== req.userId) {
        return reply.code(404).send({ error: "Chunk not found" });
      }

      await db.chunk.update({
        where: { id: chunkId },
        data: {
          status: "UPLOADED",
          providerFileId: body.providerFileId,
          checksum: body.checksum,
        },
      });

      return { success: true };
    },
  );

  app.post(
    "/files/:fileId/complete",
    {
      preHandler: requireAuth,
    },
    async (req, reply) => {
      const { fileId } = req.params as { fileId: string };
      const body = (req.body as { checksum?: string } | undefined) ?? {};

      const file = await db.file.findFirst({
        where: {
          id: fileId,
          userId: req.userId,
        },
        include: { chunks: true },
      });
      if (!file) {
        return reply.code(404).send({ error: "File not found" });
      }

      const allUploaded = file.chunks.every((c) => c.status === "UPLOADED");

      if (!allUploaded) {
        return reply.code(400).send({
          error: "Not all chunks report uploaded yet",
          pending: file.chunks
            .filter((c) => c.status !== "UPLOADED")
            .map((c) => c.id),
        });
      }

      await db.file.update({
        where: { id: fileId },
        data: {
          status: "COMPLETE",
          checksum: body.checksum,
        },
      });
      return { success: true };
    },
  );

  app.get(
    "/files/:fileId/download",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { fileId } = req.params as { fileId: string };

      const file = await db.file.findFirst({
        where: {
          id: fileId,
          userId: req.userId!,
          deletedAt: null,
        },
        include: { chunks: { orderBy: { chunkIndex: "asc" } } },
      });

      if (!file || file.status !== "COMPLETE") {
        return reply.code(404).send({ error: "File not found or incomplete" });
      }

      const manifestChunks = await Promise.all(
        file.chunks.map(async (chunk) => {
          const accessToken = await getValidAccessToken(chunk.accountId);
          return {
            chunkIndex: chunk.chunkIndex,
            url: buildDownloadUrl(chunk.providerFileId!),
            authMode: "bearer" as const,
            accessToken, // short-lived; safe to hand to the client for this one download
            checksum: chunk.checksum,
            sizeBytes: chunk.sizeBytes,
          };
        }),
      );

      return {
        fileId: file.id,
        filename: file.filename,
        encryptionIv: file.encryptionIv,
        checksum: file.checksum,
        chunks: manifestChunks,
      };
    },
  );

  //   --- Rename / move a file ---
  app.patch("/files/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { filename?: string; folderId?: string | null };

    const file = await db.file.findFirst({
      where: { id, userId: req.userId!, deletedAt: null },
    });

    if (!file) return reply.code(404).send({ error: "File not found" });

    const updated = await db.file.update({
      where: { id },
      data: {
        filename: body.filename ?? file.filename,
        folderId: body.folderId !== undefined ? body.folderId : file.folderId,
      },
    });

    return reply.code(200).send({ file: updated });
  });

  // --- Soft Delete a file ---
  app.delete("/files/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const file = await db.file.findFirst({
      where: { id, userId: req.userId!, deletedAt: null },
    });

    if (!file) return reply.code(404).send({ error: "File not found" });

    await db.file.update({ where: { id }, data: { deletedAt: new Date() } });

    return reply.code(200).send({ success: true });
  });
}
