import { head } from "@vercel/blob";
import {
  digest,
  guard,
  signSession,
  signingSecret,
  validateApplication,
  verifySession,
} from "./application.js";
import { formatApplication, dispatchEmail } from "./email.js";
import { saveApplication } from "./crm.js";

export function createSubmissionHandler({
  env = process.env,
  inspectBlob = head,
  saveCRM = saveApplication,
  sendEmail = dispatchEmail,
  logger = console,
} = {}) {
  return async function handler(req, res) {
    if (!guard(req, res)) return;
    const fail = (status, message) =>
      res.status(status).json({ success: false, message });
    let body;
    try {
      body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    } catch {
      return fail(400, "Invalid application request.");
    }
    if (!env.HUBSPOT_ACCESS_TOKEN)
      return fail(
        503,
        "Application submission is not configured. Please try again later.",
      );
    if (!env.BLOB_READ_WRITE_TOKEN)
      return fail(
        503,
        "Document storage is not connected yet. Please contact Lope or try again later.",
      );
    let application;
    let session;
    try {
      application = validateApplication(body?.application);
      if (body.action === "prepare") {
        formatApplication(
          {
            ...application,
            documents: application.documents.map((d) => ({
              ...d,
              url: "https://example.com/document",
            })),
          },
          "preparation",
        );
        const signed = signSession(application, signingSecret(env));
        return res.status(200).json({ success: true, ...signed });
      }
      if (body.action !== "finalize")
        return fail(400, "Invalid submission action.");
      session = verifySession(body.token, signingSecret(env));
      if (session.hash !== digest(application))
        return fail(400, "Application changed during upload. Please retry.");
      for (const doc of body.application.documents) {
        if (typeof doc.url !== "string" || doc.url.length > 1000)
          return fail(400, "Every supporting document must finish uploading.");
        const url = new URL(doc.url);
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          url.search ||
          !/^[a-z0-9-]+\.public\.blob\.vercel-storage\.com$/i.test(url.hostname)
        )
          return fail(400, "Invalid supporting document link.");
      }
    } catch {
      return fail(
        400,
        "Check your application fields and documents, then retry. Your upload session may have expired.",
      );
    }
    try {
      // Only metadata travels through Vercel Functions; file bytes upload directly to Blob.
      for (let start = 0; start < application.documents.length; start += 5) {
        await Promise.all(
          application.documents
            .slice(start, start + 5)
            .map(async (_, offset) => {
              const i = start + offset;
              const doc = body.application.documents[i];
              const actual = await inspectBlob(doc.url, {
                token: env.BLOB_READ_WRITE_TOKEN,
              });
              const expectedPrefix = `applications/${session.id}/${doc.id}-`;
              if (
                !actual.pathname.startsWith(expectedPrefix) ||
                actual.size !== doc.sizeBytes ||
                actual.contentType !== doc.mimeType ||
                actual.url !== doc.url
              )
                throw Object.assign(new Error("Invalid upload"), {
                  invalidUpload: true,
                });
            }),
        );
      }
      const linked = {
        ...application,
        documents: application.documents.map((d, i) => ({
          ...d,
          url: body.application.documents[i].url,
        })),
      };
      const formatted = formatApplication(linked, session.id);
      const crm = await saveCRM(linked, session.id, formatted, {
        token: env.HUBSPOT_ACCESS_TOKEN,
        logger,
      });
      const emailNotification = await sendEmail(linked, session.id, formatted, {
        env,
        logger,
      });
      return res
        .status(200)
        .json({
          success: true,
          applicationId: session.id,
          ...crm,
          documentsReceived: linked.documents.length,
          emailNotification,
        });
    } catch (error) {
      if (error?.invalidUpload)
        return fail(
          400,
          "A supporting document could not be verified. Reattach it and retry.",
        );
      logger.error("Full application submission failed", {
        applicationId: session.id,
      });
      return fail(
        502,
        "The complete application could not be confirmed. Your selected files are preserved in this tab; please retry.",
      );
    }
  };
}
export default createSubmissionHandler();
