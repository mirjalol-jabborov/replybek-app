import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The API runs on :3100. In development the app calls it through /api on its own origin,
// so the session cookie is first-party and no CORS setup is needed.
const api = process.env.REPLYBEK_API || "http://localhost:3100";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": { target: api, rewrite: (p) => p.replace(/^\/api/, "") } } },
  preview: { port: 4173, proxy: { "/api": { target: api, rewrite: (p) => p.replace(/^\/api/, "") } } },
});
