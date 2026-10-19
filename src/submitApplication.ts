import { upload } from "@vercel/blob/client";
import type { DocumentFile, FormData } from "./model";
import { payload } from "./model";

type Application = ReturnType<typeof payload>;
export interface SubmissionCache {
  fingerprint: string;
  application: Application;
  applicationId: string;
  token: string;
  createdAt: number;
  urls: Record<string, string>;
}
async function post(body: unknown) {
  const response = await fetch("/api/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const receipt = await response.json().catch(() => null);
  if (!response.ok || receipt?.success !== true)
    throw new Error(
      receipt?.message || "Application submission failed. Please retry.",
    );
  return receipt;
}
export async function submitApplication(
  data: FormData,
  documents: DocumentFile[],
  cache: { current: SubmissionCache | null },
  progress: (message: string) => void,
) {
  const fingerprint = JSON.stringify({
    data,
    documents: documents.map((d) => ({
      id: d.id,
      type: d.type,
      name: d.file.name,
      size: d.file.size,
      modified: d.file.lastModified,
    })),
  });
  let current = cache.current;
  if (
    !current ||
    current.fingerprint !== fingerprint ||
    Date.now() - current.createdAt > 55 * 60 * 1000
  ) {
    progress("Preparing your complete application…");
    const application = payload(data, documents);
    const prepared = await post({ action: "prepare", application });
    current = {
      fingerprint,
      application,
      applicationId: prepared.applicationId,
      token: prepared.token,
      createdAt: Date.now(),
      urls: {},
    };
    cache.current = current;
  }
  for (let i = 0; i < documents.length; i++) {
    const d = documents[i];
    if (current.urls[d.id]) continue;
    progress(`Uploading document ${i + 1} of ${documents.length}…`);
    const uploaded = await upload(
      `applications/${current.applicationId}/${d.id}`,
      d.file,
      {
        access: "public",
        handleUploadUrl: "/api/upload",
        contentType: d.file.type,
        clientPayload: JSON.stringify({
          token: current.token,
          documentId: d.id,
        }),
      },
    );
    current.urls[d.id] = uploaded.url;
  }
  progress("Saving your application and notifying the operations team…");
  return post({
    action: "finalize",
    token: current.token,
    application: {
      ...current.application,
      documents: current.application.documents.map((d) => ({
        ...d,
        url: current.urls[d.id],
      })),
    },
  });
}
