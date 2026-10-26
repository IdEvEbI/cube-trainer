import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const certDir = path.resolve(import.meta.dirname, ".certs");
const keyPath = path.join(certDir, "key.pem");
const certPath = path.join(certDir, "cert.pem");
const https =
  fs.existsSync(keyPath) && fs.existsSync(certPath)
    ? {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      }
    : undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    https,
  },
});
