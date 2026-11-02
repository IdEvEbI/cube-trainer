# 手机蓝牙调试（HTTPS）

iOS 上 Web Bluetooth 需在 **Bluefy** 或 **WebBLE** 中打开页面，且必须是 **HTTPS 安全上下文**。

## 两套用法怎么选

| 场景                       | 地址                                       | 说明                                                         |
| -------------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| 电脑 Chrome / 手机 Safari  | `https://<局域网IP>:5173`                  | 用本机 mkcert；Safari 需安装并信任 `rootCA.pem`              |
| **Bluefy / WebBLE 连魔方** | `https://xxxx.trycloudflare.com`（无端口） | 二者**不认**用户安装的 mkcert 根证书，须用公网 CA 的隧道地址 |

局域网自签证书在 Safari 可过、在 Bluefy / WebBLE 仍报「证书无效」，属于应用信任策略差异，不是 IP 配错。

## 局域网开发（Safari / 电脑）

1. 按当前 IP 生成证书（换 Wi‑Fi 后重做）：

   ```bash
   mkcert -cert-file .certs/cert.pem -key-file .certs/key.pem \
     localhost 127.0.0.1 ::1 <本机局域网IP>
   cp "$(mkcert -CAROOT)/rootCA.pem" .certs/rootCA.pem
   ```

2. 启动：

   ```bash
   npm run dev:lan
   ```

   （`dev:lan` 为 HTTPS + HTTP/1.1 反代，兼容性好于 Vite 默认 HTTP/2。）

3. 手机 Safari：打开 `https://<本机IP>:5173`。首次需安装 `.certs/rootCA.pem`，并在  
   **设置 → 通用 → 关于本机 → 证书信任设置** 中打开对该根证书的信任。

## Bluefy / WebBLE（推荐 Cloudflare 隧道）

本机先跑开发服务，再起隧道：

```bash
# 终端 1：开发服务（与隧道目标端口一致）
npm run dev:lan

# 终端 2：公网 HTTPS 隧道（指向本机 5173）
brew install cloudflared   # 仅首次
cloudflared tunnel --url https://127.0.0.1:5173
```

终端会打印类似：

```txt
https://molecular-treasury-address-led.trycloudflare.com
```

在 **Bluefy / WebBLE** 中打开该地址时注意：

- **不要**加 `:5173`（隧道已是 443）
- 保持 `cloudflared` 与 `npm run dev:lan` 两个进程都在跑
- 每次重启 quick tunnel，域名可能会变，以终端最新输出为准

也可把隧道指到局域网地址，例如  
`cloudflared tunnel --url https://192.168.8.5:5173`，效果相同，仍用 trycloudflare 域名访问。

## 常见问题

- **Safari 正常、Bluefy/WebBLE 证书无效**：改用 trycloudflare 地址，不要用局域网 IP。
- **隧道地址打不开**：检查是否误加了端口；确认本机 5173 服务与 cloudflared 均未退出。
- **换单位 / 回家换网**：本机 IP 变了需重签 mkcert；Bluefy 仍优先用隧道，可少受 IP 变动影响。
