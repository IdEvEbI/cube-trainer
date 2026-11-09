# Cube Trainer

魔方公式练习 + 打乱 + 计时工具（支持蓝牙魔方增强）。

## 目标

- 公式库练习（当前聚焦三阶 CFOP）
- 打乱生成与打乱计时
- 计时器（蓝牙模式支持 CFOP 分段）
- 蓝牙魔方：魔域与 Gan

## 文档入口

- [`docs/prd.md`](docs/prd.md)：产品说明与近期优先级
- [`docs/design.md`](docs/design.md)：UI/UE 约束与交互约定
- [`NOW.md`](NOW.md)：当前进度看板
- [`docs/mobile-ble-https.md`](docs/mobile-ble-https.md)：手机蓝牙 HTTPS 调试
- [`docs/formula-notation.md`](docs/formula-notation.md)：公式目录写法

## 技术栈

- Vite + React + TypeScript
- cubing.js（可视化、算法、打乱）
- gan-web-bluetooth（Gan 智能魔方）
- GitHub Pages 部署

## 目录结构

```txt
src/
├── modules/
│   ├── cube/          # 3D 可视化与转动动画
│   ├── formula/       # 公式解析与目录
│   ├── practice/      # 公式练习页
│   ├── scramble/      # 打乱、引导、观察
│   ├── timer/         # 计时器与会话状态
│   ├── score/         # 成绩存储、列表、复盘与回放
│   ├── ui/            # Toast 等通用 UI
│   └── bluetooth/     # 蓝牙适配
│       ├── brand.ts           # 魔域 / Gan 自动匹配
│       ├── moyu/              # 魔域协议
│       ├── gan/               # Gan（gan-web-bluetooth）
│       └── *.ts / Dialogs     # 对表、断开确认等
├── data/              # 公式 JSON / 目录
├── App.tsx
└── main.tsx
docs/                  # prd、design、调试说明等
```

## 开发原则

1. **分步推进**：每次只实现一个小功能，完成并确认后再继续。
2. **测试先行**：逻辑代码必须配套单元测试。
3. **界面人工确认**：UI 变更必须等待人工确认，不得自行认为完成。
4. **禁止私自提交**：未经明确指示，不得执行 git commit / push。
5. **可追溯**：重要决策记录在 `docs/prd.md`、`docs/design.md` 或 `NOW.md`。

节奏与分支约定见 [`AGENTS.md`](AGENTS.md)。

## 文档格式

Markdown 使用 Prettier 3.6.2、prettier-plugin-zh 0.7.0 与 markdownlint-cli 0.45.0。配置在 `.prettierrc`、`.markdownlint.yaml`、`.vscode/settings.json` 与 `.githooks/`。

第一次在一台电脑上打开本仓库时，在根目录运行 `npm install`。这一步会装上格式工具，并把 Git 钩子目录指到 `.githooks/`。若跳过安装，需要自己执行 `git config core.hooksPath .githooks`，否则提交说明检查不会生效。

改完 Markdown 之后、提交之前，运行 `npm run format` 与 `npm run lint:md`。`format` 调用 Prettier，用来统一空格和换行；`lint:md` 调用 markdownlint，用来检查标题层级和列表写法。在编辑器里保存 Markdown 时，会按本仓库配置自动整理。编辑器建议安装的扩展写在 `.vscode/extensions.json`。

提交说明须写成 `类型(范围): 原因`，类型只能是 `docs`、`feat`、`fix` 或 `chore`。不合格的说明会被钩子拦住。

中文和英文、数字之间保留空格。需要故意不加空格时，把那几个字放进行内代码。

## 里程碑

- [x] M1：项目骨架 + 基础计时器
- [x] M2：公式库列表 + 静态数据
- [x] M3：cubing.js 可视化
- [x] M4：蓝牙适配（魔域 + Gan）
- [x] M5：打乱计时闭环 + 成绩复盘 / 列表

下一步见 [`NOW.md`](NOW.md)（如公式练习蓝牙闭环）。

## 浏览器要求

- 蓝牙功能：Chrome / Edge（桌面或 Android）；iOS 用 Bluefy / WebBLE
- 其他浏览器降级为手动模式

## 手机蓝牙调试（HTTPS）

iOS 上 Bluefy / WebBLE **不认**本机 mkcert，需用 Cloudflare 隧道提供公网证书。完整步骤见 [`docs/mobile-ble-https.md`](docs/mobile-ble-https.md)。

摘要：

```bash
npm run dev:lan
brew install cloudflared   # 仅首次
cloudflared tunnel --url https://127.0.0.1:5173
```

在 Bluefy / WebBLE 打开终端给出的 `https://xxxx.trycloudflare.com`（**不要**加 `:5173`）。
