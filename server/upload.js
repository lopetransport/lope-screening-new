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

export function createUploadHandler({ env = process.env, sdkHandleUpload = handleUpload, logger = console } = {}) {
  return async function handler(req, res) {
    if (!guard(req, res)) return;
    const fail = (status, code, message) => {
      logger.error('Document upload failed', { code });
      return res.status(status).json({ success: false, code, message });
    };
    const token = env.BLOB_READ_WRITE_TOKEN?.trim();
    if (!token) return fail(503, 'BLOB_TOKEN_MISSING', 'Document storage is not configured: connect a Public Blob store and set BLOB_READ_WRITE_TOKEN for this Vercel environment, then redeploy.');
    if (!/^vercel_blob_rw_[A-Za-z0-9-]+_[^\s"']+$/.test(token)) return fail(503, 'BLOB_TOKEN_INVALID', 'The server BLOB_READ_WRITE_TOKEN is not a valid read-write token. Check the connected Blob store and redeploy.');
    if (!signingSecret(env)) return fail(503, 'SIGNING_SECRET_MISSING', 'Upload authorization is not configured. Check the server signing secret or HubSpot token.');
    try {
      const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      if (!body || !['blob.generate-client-token', 'blob.upload-completed'].includes(body.type)) return fail(400, 'INVALID_UPLOAD_EVENT', 'Invalid document upload request.');
      let authorization;
      if (body.type === 'blob.generate-client-token') {
        try { authorization = authorizeUpload(body.payload?.pathname, body.payload?.clientPayload, env); }
        catch (error) { return fail(400, 'UPLOAD_SESSION_INVALID', 'Your document upload session expired or is invalid. Please submit again to start a new session.'); }
      }
      const result = await sdkHandleUpload({
        token,
        body,
        request: req,
        onBeforeGenerateToken: async (pathname, clientPayload) => {
          return authorization || authorizeUpload(pathname, clientPayload, env);
        },
        // Finalization checks Blob metadata itself. No callback URL is needed.
      });
      if (body.type === 'blob.generate-client-token' && (typeof result?.clientToken !== 'string' || !result.clientToken.startsWith('vercel_blob_client_'))) return fail(502, 'BLOB_TOKEN_RESPONSE_INVALID', 'The upload service did not return an upload token. Please retry.');
      return res.status(200).json(result);
    } catch {
      return fail(502, 'BLOB_TOKEN_GENERATION_FAILED', 'The document upload service could not authorize this upload. Check the connected Public Blob store and server token, then retry.');
    }
  };
}
export default createUploadHandler();
