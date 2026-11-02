import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const certDir = path.resolve(import.meta.dirname, ".certs");
const keyPath = path.join(certDir, "key.pem");
const certPath = path.join(certDir, "cert.pem");
/** 由 `npm run dev:lan` 前置代理提供 HTTPS；Vite 本体只跑 HTTP，便于 Bluefy（偏旧 WebKit）。 */
const behindLanProxy = process.env.VITE_LAN_PROXY === "1";
const https =
  !behindLanProxy && fs.existsSync(keyPath) && fs.existsSync(certPath)
    ? {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      }
    : undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    host: behindLanProxy ? "127.0.0.1" : true,
    https,
    hmr: behindLanProxy
      ? {
          protocol: "wss",
          clientPort: 5173,
        }
      : undefined,
  },
});
