/**
 * 局域网手机调试入口：HTTPS + HTTP/1.1 反代到本机 Vite。
 * 规避 Vite 默认 HTTP/2，改善 Bluefy（旧 WebKit）打开失败。
 *
 * 用法：npm run dev:lan
 * 手机访问：https://<本机局域网IP>:5173
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keyPath = path.join(root, ".certs/key.pem");
const certPath = path.join(root, ".certs/cert.pem");
const VITE_PORT = 5174;
const LAN_PORT = 5173;

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error("缺少 .certs/key.pem 或 .certs/cert.pem，请先用 mkcert 生成。");
  process.exit(1);
}

const key = fs.readFileSync(keyPath);
const cert = fs.readFileSync(certPath);

const vite = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["vite", "--host", "127.0.0.1", "--port", String(VITE_PORT)],
  {
    cwd: root,
    env: { ...process.env, VITE_LAN_PROXY: "1" },
    stdio: "inherit",
  },
);

function proxyHttp(clientReq, clientRes) {
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: VITE_PORT,
      path: clientReq.url,
      method: clientReq.method,
      headers: {
        ...clientReq.headers,
        host: `127.0.0.1:${VITE_PORT}`,
      },
    },
    (upRes) => {
      clientRes.writeHead(upRes.statusCode ?? 502, upRes.headers);
      upRes.pipe(clientRes);
    },
  );
  upstream.on("error", () => {
    if (!clientRes.headersSent) {
      clientRes.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    }
    clientRes.end("Vite 尚未就绪，请稍候重试。");
  });
  clientReq.pipe(upstream);
}

const server = https.createServer({ key, cert }, proxyHttp);

server.on("upgrade", (req, socket, head) => {
  const upstream = net.connect(VITE_PORT, "127.0.0.1", () => {
    const headerLines = Object.entries(req.headers)
      .filter(([, value]) => value !== undefined)
      .map(
        ([name, value]) =>
          `${name}: ${Array.isArray(value) ? value.join(", ") : value}`,
      );
    upstream.write(
      `${req.method} ${req.url} HTTP/1.1\r\n${headerLines.join("\r\n")}\r\n\r\n`,
    );
    if (head.length > 0) {
      upstream.write(head);
    }
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  upstream.on("error", () => {
    socket.destroy();
  });
  socket.on("error", () => {
    upstream.destroy();
  });
});

server.listen(LAN_PORT, "0.0.0.0", () => {
  console.log("");
  console.log(`LAN HTTPS (HTTP/1.1) → Vite :${VITE_PORT}`);
  console.log(`  手机请打开: https://<本机IP>:${LAN_PORT}/`);
  console.log("");
});

function shutdown() {
  server.close();
  vite.kill("SIGTERM");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
vite.on("exit", (code) => {
  server.close();
  process.exit(code ?? 0);
});
