import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ command, mode }) => {
  if (command === "build") {
    const env = loadEnv(mode, ".", "VITE_");
    const endpoint = env.VITE_APPLICATION_ENDPOINT?.trim();
    if (endpoint) {
      let url: URL;
      try {
        url = new URL(endpoint);
      } catch {
        throw new Error("VITE_APPLICATION_ENDPOINT must be an absolute HTTPS API URL.");
      }
      if (url.protocol !== "https:" || url.username || url.password) {
        throw new Error("VITE_APPLICATION_ENDPOINT must use HTTPS without embedded credentials.");
      }
      for (const key of ["VITE_TERMS_TEXT", "VITE_PRIVACY_TEXT"]) {
        if (!env[key]?.trim()) {
          throw new Error(`${key} must contain approved policy text when an API endpoint is configured.`);
        }
      }
      console.log("Deployment configuration checked: HTTPS API and policy text supplied.");
    } else {
      console.log("Deployment mode: preview. Application data will not be submitted.");
    }
  }
  return { plugins: [react(), tailwindcss()] };
});
