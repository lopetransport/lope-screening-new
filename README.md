# Lope onboarding with HubSpot

React, TypeScript, Tailwind and Vite front end plus a Vercel Node server endpoint.

## Deploy

See DEPLOY-VERCEL.md. Upload the entire source tree, including `api/`, `server/`, `src/` and `public/`, along with package.json, package-lock.json, vite.config.ts, tsconfig.json, index.html and vercel.json. The logo and copyright layout are preserved.

Configure Vercel environment variables:

- `HUBSPOT_ACCESS_TOKEN`: server-only private app token with contact write access. Never use a VITE_ prefix or commit a real token.
- `VITE_TERMS_TEXT`: approved terms describing this sign-up flow.
- `VITE_PRIVACY_TEXT`: approved privacy text describing transmission to HubSpot.

Redeploy after configuration. Revoke the token shared in chat and use its replacement. No credential has been written into this source package.

## Submission

The actual form handler lives in src/App.tsx; main.tsx mounts the app. The browser POSTs JSON to `/api/submit`. That function POSTs `{ properties: { email, firstname, lastname, phone, company } }` to `https://api.hubapi.com/crm/v3/objects/contacts` with the server-side Bearer token and application/json header. First name is the first word of Full Name, surname is the remaining words, and company is blank for individual registrations. Phone is normalized to +27.

HTTP 200/201 with a contact ID opens the success step. The reference is the HubSpot contact ID. Duplicate email, rate limits, rejected requests, missing configuration, timeouts and network failures show safe messages and preserve the form for correction/retry. Duplicate contacts are not overwritten. No real HubSpot call was made during verification.

This creates a contact only. It does not upload documents or persist banking, identity, vehicle details or consent records in HubSpot. The form and completion screen explicitly explain that scope. The existing document step and other fields remain intact as requested. Add a separate storage integration if the complete application must be retained. application.schema.json and example-payload.json describe that broader application model, not the five-property contact request.

## Local development

Use Node 22.x. `npm ci`, `npm run dev`, `npm test`, `npm run build`. Vite dev and static preview do not run Vercel Functions. Use `npx vercel dev` for the complete local submission flow, with a local ignored .env.local configured from .env.example. A plain static host cannot execute the API function.

Production build and all 11 mocked validation/API tests passed. Tests verify mapping, authorization construction, 200/201 success, bad input, consent checks, origin checks, duplicate/rate-limit/errors and malformed receipts. Actual token permissions and live HubSpot connectivity remain to be verified after deployment.
