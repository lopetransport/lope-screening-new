# Vercel deployment: HubSpot integration

1. Extract the updated ZIP and upload its contents to your GitHub repository, preserving the api/, src/, public/ and tests/ folders. Include package.json, package-lock.json, vite.config.ts, tsconfig.json, index.html and vercel.json.
2. Import the repository into Vercel. Set Root Directory to the directory containing package.json. Framework: Vite; Node: 22.x; build: npm run vercel-build; output: dist. vercel.json supplies those build settings and excludes /api paths from the SPA rewrite.
3. In Project Settings -> Environment Variables, add HUBSPOT_ACCESS_TOKEN using a replacement private app token. It must have crm.objects.contacts.write access. This variable is server-only: do not prefix it with VITE_.
4. Add VITE_TERMS_TEXT and VITE_PRIVACY_TEXT containing approved policy text. The UI blocks submission until both are supplied. These two values are public and embedded during the build.
5. Apply the variables to Production and any Preview environment you intend to test, then deploy/redeploy.
6. Submit a deliberate test sign-up using an email you control, check the success reference, then check the contact in HubSpot. This creates a real CRM contact. No live CRM contact was created during development.

The app sends only name, email, phone and company. It does not save uploaded files or other application fields. See README.md for scope, mapping and error handling.

If the form shows 'not configured', check the server-only token and redeploy. If it says submission is unavailable until policies are configured, set the public policy variables and rebuild. If /api/hubspot-contact returns HTML or 404, confirm the api folder and updated vercel.json were uploaded; deploy the source project rather than only dist/. For a duplicate-email message, check the existing CRM record rather than repeatedly submitting. Vercel logs should not contain tokens or applicant payloads.

The earlier VITE_APPLICATION_ENDPOINT variable is no longer used. This version always uses the same-origin Vercel function.

References: https://developers.hubspot.com/docs/api-reference/legacy/crm/objects/contacts/create-contact and https://vercel.com/docs/functions
