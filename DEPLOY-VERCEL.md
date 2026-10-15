# Deploy to Vercel

This project includes `vercel.json`, a locked npm dependency tree and a Node 22 runtime selection. Vercel installs dependencies with `npm ci`, checks deployment configuration inside Vite and builds `dist/`. Tests can be run separately with `npm test`. SPA rewrites support direct navigation/refresh. Hashed assets receive immutable caching.

## Recommended: GitHub import

1. Extract `lope-screening-vercel.zip` into a folder.
2. Upload the extracted **contents** to a GitHub repository. `package.json`, `vercel.json`, `vite.config.ts`, `index.html` and `src/` must be at the repository root. Include `package-lock.json`, `tsconfig.json` and dotfiles. Do not upload `node_modules` or `.env.local`. No separate deployment-check script is required.
3. In Vercel, choose **Add New → Project** and import that repository.
4. Use these settings. The configuration file already supplies the commands:

| Setting | Value |
|---|---|
| Framework | Vite |
| Root Directory | Repository root (`./`) |
| Node.js | 22.x (selected by package.json) |
| Install Command | `npm ci --no-audit --no-fund` |
| Build Command | `npm run vercel-build` |
| Output Directory | `dist` |

5. Click **Deploy**. With no environment variables, the complete form runs in preview mode; it does not store applications on a server.
6. Open the returned Vercel URL. Complete a synthetic application to confirm step navigation and the explicitly labelled preview confirmation. Refresh the page to confirm the application loads.

If your repository includes an outer `lope-screening/` folder, select that folder as the Root Directory instead. Do not select `src/` or `dist/`.

## Enable real submissions

In Project Settings → Environment Variables, configure:

| Name | Value |
|---|---|
| `VITE_APPLICATION_ENDPOINT` | Your absolute HTTPS application API URL |
| `VITE_TERMS_TEXT` | Company-approved Terms of Use text |
| `VITE_PRIVACY_TEXT` | Company-approved privacy text |

Apply the variables to the intended Production/Preview environments and redeploy. Vite embeds these public values during the build. Changing them requires a new deployment. Do not put API passwords, private webhook tokens or other secrets in these variables.

The build fails with a clear message if a supplied endpoint is malformed, uses HTTP/embedded credentials, or lacks policy text. Missing endpoint is intentional preview mode. This configuration does not create a database, upload store or API. The existing API contract is in README.md.

The backend must allow your production domain via CORS if hosted on another origin. Add preview origins deliberately if you test against the backend from preview deployments. The response must be HTTP 2xx with JSON `{ "applicationId": "reference" }`.

Files can be 10 MB each and multiple files may be attached. Choose an API/upload service that supports the complete request size. If later implementing Vercel Functions, check current request-body limits and use direct-to-storage uploads where needed rather than assuming the existing multipart flow can accept every permitted file.

## Alternative: Vercel CLI

From the extracted directory containing `package.json`:

```sh
npx vercel
```

Follow the sign-in and project prompts to create a preview deployment. When satisfied, run:

```sh
npx vercel --prod
```

Use the normal source deployment command. `--prebuilt` expects Vercel's own build output, not the Vite `dist/` directory.

## Troubleshooting

- Missing output directory / package.json: check Root Directory and remove conflicting dashboard command overrides.
- Wrong runtime: package.json deliberately selects Node 22.x; use that version locally too.
- Environment-variable error: supply all three public variables for real submission, or leave the endpoint blank for preview.
- Form renders but submission fails: check the API response, CORS and upload limits. Successful front-end deployment alone does not establish backend connectivity.

Official references: [Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), [Build configuration](https://vercel.com/docs/builds/configure-a-build), [Node versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).
