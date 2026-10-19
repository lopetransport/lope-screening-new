import { handleUpload } from "@vercel/blob/client";
import { guard, signingSecret, verifySession } from "./application.js";

export function authorizeUpload(pathname, clientPayload, env = process.env) {
  const { token, documentId } = JSON.parse(clientPayload || "{}");
  const session = verifySession(token, signingSecret(env));
  const doc = session.documents.find((d) => d.id === documentId);
  if (!doc || pathname !== `applications/${session.id}/${doc.id}`)
    throw new Error("Upload not authorized.");
  return {
    allowedContentTypes: [doc.mimeType],
    maximumSizeInBytes: doc.sizeBytes,
    addRandomSuffix: true,
    allowOverwrite: false,
    validUntil: Date.now() + 15 * 60 * 1000,
    tokenPayload: JSON.stringify({ applicationId: session.id }),
  };
}

export default async function handler(req, res) {
  if (!guard(req, res)) return;
  if (!process.env.BLOB_READ_WRITE_TOKEN || !signingSecret(process.env))
    return res
      .status(503)
      .json({ message: "Document storage is not connected yet." });
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        return authorizeUpload(pathname, clientPayload);
      },
      onUploadCompleted: async () => {
        /* Final submission independently verifies each blob. */
      },
    });
    return res.status(200).json(result);
  } catch {
    console.error("Document upload authorization failed");
    return res
      .status(400)
      .json({
        message:
          "Document upload could not start. Retry the application submission.",
      });
  }
}
