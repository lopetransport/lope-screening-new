# Deploy the full application workflow

1. Deploy main from lopetransport/lope-screening-new in Vercel. Root Directory is the folder with package.json; framework Vite; Node 22.x; build npm run vercel-build; output dist. vercel.json keeps /api routes out of the SPA rewrite.
2. In the Vercel project's Storage tab, connect a **Public Vercel Blob** store. Select Production and any Preview environments you intend to use. This provides BLOB_READ_WRITE_TOKEN. No Amazon S3 setup is needed. The token remains server-only. Public access is deliberate because the requested email contains directly accessible file links.
3. Retain HUBSPOT_ACCESS_TOKEN. The private app needs contact create/update and associated-note creation permissions. The full application is saved in the contact's activity timeline as a note, including every document URL. Do not set this token as VITE_...
4. To enable email, create a Resend API key and set RESEND_API_KEY in Vercel. Verify lopetransport.co.za in Resend, or set APPLICATION_FROM_EMAIL to a sender on another verified domain. Default sender is Lope Transport Services <ops@lopetransport.co.za>. The recipient is fixed in backend code to ops@lopetransport.co.za and cannot be changed by browser input.
5. If RESEND_API_KEY is absent, leave it unset. Applications still save to HubSpot, server logs record the reference/status only, and the final receipt explicitly says that email could not be sent. A configured provider that fails also preserves the CRM copy. There is no background retry queue; review the CRM notes until email is enabled.
6. Set VITE_TERMS_TEXT and VITE_PRIVACY_TEXT to approved policy text covering the complete data transfer, public document links, CRM storage and operations email. Optionally set APPLICATION_SIGNING_SECRET to a long independent random value. Without it, the HubSpot token signs application sessions. Redeploy after setting variables.
7. Run a deliberate test with synthetic information and an email address you control. Confirm the receipt, HubSpot contact and associated full application note, and (when configured) email receipt in the operations mailbox. Open each linked file and check names/categories, banking fields, entity fields and every truck. Do not assume the build alone verifies provider credentials or delivery.

Missing Blob storage produces an actionable error before file upload instead of broken document links. Local File/blob URLs and base64/data URLs are not sent as document links: they are not durable, and large base64 payloads exceed Vercel's body limits and email/CRM note constraints.

The only required new resource is a connected Public Vercel Blob store. Resend remains optional until you configure it. All credentials stay in Vercel environment variables. Client code calls only relative /api/submit and /api/upload routes for application/token exchange; file bytes go directly to Vercel Blob using short-lived scoped upload tokens.

## Files to preserve

api/submit.ts, api/upload.ts; server/application.js, server/submission.js, server/upload.js, server/crm.js, server/email.js; application.schema.json; src/ and public/logo.png; package.json and package-lock.json; tsconfig.json, vite.config.ts and vercel.json. Do not upload node_modules or real .env files.

Official references: https://vercel.com/docs/vercel-blob/client-upload, https://resend.com/docs/api-reference/emails/send-email, https://resend.com/docs/dashboard/emails/idempotency-keys, https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/contacts/guide.

## Troubleshoot client token retrieval

The upload route passes BLOB_READ_WRITE_TOKEN explicitly to handleUpload. It must be a long-lived read-write token from the connected Public Blob store, not a store ID, OIDC token, or a VITE_ variable. Confirm it exists for the exact environment (Production or Preview), contains no surrounding quotes, and redeploy after correcting it. Do not send credentials in chat. The browser requests a scoped client token from /api/upload and uses the SDK client put method to upload the file directly to Blob. It never receives the server token.

The route returns specific codes for BLOB_TOKEN_MISSING, BLOB_SDK_CREDENTIAL_REJECTED, UPLOAD_SESSION_INVALID and BLOB_TOKEN_GENERATION_FAILED. The browser displays the associated message. A 200 HTML response instead of JSON indicates that /api/upload is being rewritten to the application or the wrong Vercel project is deployed. The API remains excluded from the SPA rewrite in vercel.json. A session error clears the cached session so retry creates a new one.

There is no upload-completion callback dependency: finalization checks every Blob independently. Server-side file proxying is deliberately not used because the form permits 10 MB files, which exceed Vercel Functions request-size limits; a server-side put would still require valid Blob credentials.

The application does not validate credential prefixes or character patterns. It trims surrounding whitespace and passes the configured credential directly to the installed SDK. BLOB_SDK_CREDENTIAL_REJECTED is returned only when the SDK itself rejects the credential; the old application-defined BLOB_TOKEN_INVALID error has been removed.
