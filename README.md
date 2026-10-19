# Lope complete onboarding submissions

React + TypeScript + Tailwind front end, Vercel Functions, Vercel Blob documents, HubSpot CRM and optional Resend notifications. No S3 bucket is required. The logo and footer remain intact.

## What is saved and sent

The browser submits the complete `payload()` from src/model.ts: applicant name/ID/passport/entity, business/BEEE/CIPC, phone/email/address/province, every truck with capacity and horse/trailer plates, bank/account holder/account number/type/branch, every supporting-document category/name/MIME/size/URL, consent flags and policy versions, and client submission timestamp. All data and links are stored as a HubSpot note associated with the primary contact. Existing contacts are updated by email; new contacts are created. An HTML and text notification is dispatched to **ops@lopetransport.co.za** when Resend is configured. Contact properties remain firstname, lastname, email, phone and company.

The actual form handler is in src/App.tsx; src/main.tsx mounts the app. src/submitApplication.ts orchestrates the two-phase submission:

1. POST `/api/submit` with `action: prepare` and the full application. Server-side JSON Schema validation returns a signed one-hour upload session bound to the exact application and document metadata.
2. Upload each file directly to a connected Public Vercel Blob store through the SDK, authorized by `/api/upload`. Tokens allow only the session's document paths, MIME type and byte limit. Each file can be up to 10 MB; at most 20 documents / 100 MB combined and 20 trucks are supported. No file bytes/base64 travel through Vercel Functions, avoiding their request-size limits.
3. POST `/api/submit` with `action: finalize`, signed session and the same application plus generated document URLs. Server checks each Blob's path, size, type and URL, saves the CRM contact and full application note, then attempts email.
4. Only after the CRM note is saved does the user see the complete-application success screen. The receipt says separately whether the email provider accepted the message. Provider acceptance does not guarantee inbox delivery.

Retries within the same tab preserve uploaded URLs and the application session for up to 55 minutes; edited application data starts a new session. Resend uses an application-specific idempotency key (provider window: 24 hours). HubSpot notes may duplicate if a request fails after note creation but before the browser receives confirmation. There is no background retry queue for failed emails.

## Required and optional configuration

See DEPLOY-VERCEL.md. Required server-only variables: HUBSPOT_ACCESS_TOKEN and BLOB_READ_WRITE_TOKEN (automatically added by connecting a Public Vercel Blob store). RESEND_API_KEY is optional: absent key or an email API failure never discards a successfully saved full CRM application. Only the application reference/status is logged; banking details and applicant payloads are never printed. Such receipts explicitly state that email could not be sent. APPLICATION_FROM_EMAIL defaults to Lope Transport Services <ops@lopetransport.co.za>; verify that sender domain in Resend before enabling email.

VITE_TERMS_TEXT and VITE_PRIVACY_TEXT must contain approved policy copy describing the full data flow. No secret may have a VITE_ prefix. APPLICATION_SIGNING_SECRET is optional; without it, the server uses the HubSpot token with a domain-separated HMAC to sign upload sessions.

The HubSpot private app must be permitted to create/update contacts and create notes associated with contacts. If CRM note creation is rejected, the frontend shows an error instead of pretending that the complete application was retained. Verify permissions in a controlled deployment test.

## Document access and operation

As explicitly requested, documents use direct public Vercel Blob URLs with random suffixes. Anyone holding a URL can open it. Filenames in object paths contain only generated IDs; original filenames are included in the email/note. Full application JSON and banking details are not put in public Blob storage. Do not publish Blob URLs in logs or a public index. Deleting a Blob breaks links in existing emails and CRM notes. Choose retention rules appropriate to actual operations; no automatic deletion job or antivirus scanning is included. Failed/abandoned submissions can leave orphan uploads, which need periodic operator cleanup in Blob Storage.

## Development and verification

Node 22.x: npm ci, npm run dev, npm test, npm run build. Vite dev does not run serverless routes; use `npx vercel dev` and ignored local .env.local for an end-to-end integration test. Deploy the entire source tree (api/, server/, src/, public/, tests/ and root configuration), not only dist/.

Tests mock external providers. They cover complete field validation, signed sessions, file authorization, HTML escaping, every fleet/bank/document field in email, destination/idempotency, HubSpot create/update/note linkage, fallback behavior, upload verification and error receipts. Actual HubSpot, Blob and Resend services have not been exercised using production credentials. No real applicant or email was sent during development.
