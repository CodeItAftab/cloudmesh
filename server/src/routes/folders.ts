import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../lib/db.js";
import { requireAuth } from "../middlewares/requireAuth.js";

const createFolderSchema = z.object({
  name: z
    .string()
    .min(1, "Folder name is required")
    .max(255, "Folder name must be less than 255 characters"),
  parentFolderId: z.string().uuid().nullable().optional(),
});

const updatedFolderSchema = z.object({
  name: z
    .string()
    .min(1, "Folder name is required")
    .max(255, "Folder name must be less than 255 characters")
    .optional(),
  parentFolderId: z.string().uuid().nullable().optional(),
});

/**
 * Builds the materialized path string for a folder given its parent.
 * Root folders get "/<their-own-id>/". Nested folders append their id
 * onto their parent's existing path. This lets us find "all descendants
 * of X" with a single indexed LIKE query instead of a recursive one.
 */

function buildPath(parentPath: string | null, folderId: string): string {
  return `${parentPath ?? "/"}${folderId}/`;
}

export async function foldersRoutes(app: FastifyInstance) {
  // Create a new folder
  app.post("/folders", { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createFolderSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }

    const { name, parentFolderId } = parsed.data;
    const userId = req.userId;

    if (!userId) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    let parent = null;

    if (parentFolderId) {
      parent = await db.folder.findFirst({
        where: {
          id: parentFolderId,
          userId: userId,
          deletedAt: null,
        },
      });

      if (!parent) {
        return reply.status(404).send({ error: "Parent folder not found" });
      }
    }

    /*
     * Create first without a final path, since we need the new row's own
     * id to compuute the path --- immediately patch it in.
     */

    const folder = await db.folder.create({
      data: {
        userId,
        parentFolderId: parentFolderId ?? null,
        name,
        path: "", // temporary placeholder
      },
    });

    const path = buildPath(parent?.path ?? null, folder.id);
    const updated = await db.folder.update({
      where: { id: folder.id },
      data: { path },
    });

    return reply.code(201).send({ folder: updated });
  });

  //   List folders
  app.get(
    "/folders/:folderId/contents",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { folderId } = req.params as { folderId: string };
      const userId = req.userId;

      if (!userId) {
        return reply.status(401).send({ error: "Unauthorized" });
      }

      const parentFolderId = folderId === "root" ? null : folderId;

      const [subFolder, files] = await Promise.all([
        db.folder.findMany({
          where: {
            userId,
            parentFolderId,
            deletedAt: null,
          },
          orderBy: { name: "asc" },
        }),
        db.file.findMany({
          where: { userId, folderId: parentFolderId, deletedAt: null },
          orderBy: { filename: "asc" },
        }),
      ]);

      return reply.send({ folders: subFolder, files });
    },
  );

  //   Rename of move a folder

  app.patch(
    "/folders/:folderId",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const userId = req.userId!;
      const parsed = updatedFolderSchema.safeParse(req.body);

      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }

      const folder = await db.folder.findFirst({
        where: { id, userId, deletedAt: null },
      });

      if (!folder) {
        return reply.status(404).send({ error: "Folder not found" });
      }

      const { name, parentFolderId } = parsed.data;

      //   Simple rename only -- no path recalculation needed
      if (parentFolderId === undefined) {
        const updated = await db.folder.update({
          where: { id },
          data: { name: name ?? folder.name },
        });

        return reply.send({ folder: updated });
      }

      //  moving ---> guard against moving a folder into itself or into a non-existent parent
      if (parentFolderId == id) {
        return reply
          .status(400)
          .send({ error: "Cannot move a folder into itself" });
      }

      let newParent = null;

      if (parentFolderId) {
        newParent = await db.folder.findFirst({
          where: { id: parentFolderId, userId, deletedAt: null },
        });

        if (!newParent) {
          return reply
            .status(404)
            .send({ error: "New parent folder not found" });
        }

        if (newParent.path.includes(`/${id}/`)) {
          return reply.code(400).send({
            error: "Cannot move a folder into one of its descendants",
          });
        }
        const oldPath = folder.path;
        const newPath = buildPath(newParent?.path ?? null, id);
        // Update this folder, then re-point every descendant's path prefix
        // from oldPath to newPath in one query, since paths encode ancestry.
        await db.$transaction([
          db.folder.update({
            where: { id },
            data: {
              name: name ?? folder.name,
              parentFolderId: parentFolderId ?? null,
              path: newPath,
            },
          }),
          //   Update all descendants' paths to reflect the new ancestry
          db.$executeRaw`
            UPDATE "Folder"
            SET path = ${newPath} || substring(oldPath from ${oldPath.length + 1})
            WHERE path LIKE ${oldPath + "%"} AND id != ${id} AND "userId" = ${userId}  
          `,
        ]);

        const updated = await db.folder.findUnique({ where: { id } });
        return reply.send({ folder: updated });
      }
    },
  );

  //   --- Soft-delte a folder (and cascade to descendants + their files) ---

  app.delete(
    "/folders/:id",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const userId = req.userId!;

      const folder = await db.folder.findFirst({
        where: { id, userId, deletedAt: null },
      });

      if (!folder) {
        return reply.status(404).send({ error: "Folder not found" });
      }

      const now = new Date();
      // Every folder whose path starts with this folder's path is a descendant
      // (including itself, since its own path is a prefix of itself).

      await db.$transaction([
        // Mark this folder and all its descendants as deleted
        db.$executeRaw`
        UPDATE "Folder" SET "deletedAt" = ${now}
            WHERE "userId" = ${userId} AND path LIKE ${folder.path + "%"} AND "deletedAt" IS NULL
        `,
        // Cascade the deletion to all files in this folder and its descendants
        db.$executeRaw`
            UPDATE "File" SET "deletedAt" = ${now}
            WHERE "userId" = ${userId} AND "deletedAt" IS NULL AND "folderId" IN (
                SELECT id FROM "Folder" WHERE "userId" = ${userId} AND path LIKE ${folder.path + "%"}
            )
        `,
      ]);

      return reply.send({ success: true });
    },
  );

  // --- Restore a soft-deleted folder ---
  app.post(
    "/folder/:id/restore",
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const userId = req.userId!;
      const folder = await db.folder.findFirst({
        where: { id, userId, deletedAt: { not: null } },
      });

      if (!folder) {
        return reply
          .status(404)
          .send({ error: "Folder not found or not deleted" });
      }

      // Restore this folder and all its descendants
      await db.$transaction([
        db.$executeRaw`
                UPDATE "Folder" SET "deletedAt" = NULL
                WHERE "userId" = ${userId} AND path LIKE ${folder.path + "%"} AND "deletedAt" IS NOT NULL
            `,
        db.$executeRaw`
                UPDATE "File" SET "deletedAt" = NULL
                WHERE "userId" = ${userId} AND "deletedAt" IS NOT NULL AND "folderId" IN (
                    SELECT id FROM "Folder" WHERE "userId" = ${userId} AND path LIKE ${folder.path + "%"}
                )
            `,
      ]);

      return reply.send({ success: true });
    },
  );
}
