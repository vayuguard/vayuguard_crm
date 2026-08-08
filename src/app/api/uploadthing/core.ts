import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { auth } from "@/server/auth";
import { hasPermission } from "@/lib/permissions";

const f = createUploadthing();

async function requireUploadUser(permission?: "documents:write" | "leads:write") {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UploadThingError("Unauthorized");
  }
  if (
    permission &&
    !hasPermission(session.user.permissions, permission)
  ) {
    throw new UploadThingError("Forbidden");
  }
  return { userId: session.user.id };
}

/**
 * UploadThing file router for documents and lead attachments.
 * If UPLOADTHING_TOKEN / UPLOADTHING_SECRET is missing, route handlers
 * still load but uploads will fail gracefully at the provider layer.
 */
export const ourFileRouter = {
  documentUploader: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 5 },
    image: { maxFileSize: "8MB", maxFileCount: 10 },
    text: { maxFileSize: "4MB", maxFileCount: 5 },
    blob: { maxFileSize: "16MB", maxFileCount: 5 },
  })
    .middleware(async () => requireUploadUser("documents:write"))
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        uploadedById: metadata.userId,
        url: file.ufsUrl,
        name: file.name,
        size: file.size,
        type: file.type,
        purpose: "document" as const,
      };
    }),

  leadAttachmentUploader: f({
    pdf: { maxFileSize: "16MB", maxFileCount: 5 },
    image: { maxFileSize: "8MB", maxFileCount: 10 },
    text: { maxFileSize: "4MB", maxFileCount: 5 },
    blob: { maxFileSize: "16MB", maxFileCount: 5 },
  })
    .middleware(async () => requireUploadUser("leads:write"))
    .onUploadComplete(async ({ metadata, file }) => {
      return {
        uploadedById: metadata.userId,
        url: file.ufsUrl,
        name: file.name,
        size: file.size,
        type: file.type,
        purpose: "lead-attachment" as const,
      };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;

export function isUploadThingConfigured() {
  return Boolean(
    process.env.UPLOADTHING_TOKEN ||
      process.env.UPLOADTHING_SECRET ||
      process.env.UPLOADTHING_APP_ID,
  );
}
