# Cube Trainer

魔方公式练习 + 打乱 + 计时工具（支持蓝牙魔方增强）。

## 目标

- 公式库练习（2x2 / 3x3 / 4x4 / 5x5）
- 打乱生成
- 计时器（支持目标分段）
- 可选：连接 GAN / 魔域蓝牙魔方

## 技术栈

- Vite + React + TypeScript
- cubing.js（可视化、算法、打乱、GAN 蓝牙）
- btcube-web（魔域补位，按需）
- GitHub Pages 部署

## 目录结构

```txt
src/
├── modules/
│   ├── cube/          # cubing.js 可视化封装
│   ├── formula/       # 公式库
│   ├── scramble/      # 打乱
│   ├── timer/         # 计时器
│   └── bluetooth/     # 统一蓝牙适配层
│       ├── index.ts
│       ├── cubingAdapter.ts
│       ├── btcubeAdapter.ts
│       └── types.ts
├── data/              # 公式 JSON
├── App.tsx
└── main.tsx
```

## 统一蓝牙接口

```ts
export interface CubeMoveEvent {
  move: string;
  timestamp: number;
}

export interface BluetoothCube {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  onMove(cb: (e: CubeMoveEvent) => void): () => void;
  getName(): string | undefined;
}
```

## 开发原则

1. **分步推进**：每次只实现一个小功能，完成并确认后再继续。
2. **测试先行**：逻辑代码必须配套单元测试。
3. **界面人工确认**：UI 变更必须等待人工确认，不得自行认为完成。
4. **禁止私自提交**：未经明确指示，不得执行 git commit / push。
5. **可追溯**：重要决策记录在本文件或 `docs/` 中。

## 文档格式

Markdown 使用 Prettier 3.6.2、prettier-plugin-zh 0.7.0 与 markdownlint-cli 0.45.0。配置在 `.prettierrc`、`.markdownlint.yaml`、`.vscode/settings.json` 与 `.githooks/`。

第一次在一台电脑上打开本仓库时，在根目录运行 `npm install`。这一步会装上格式工具，并把 Git 钩子目录指到 `.githooks/`。若跳过安装，需要自己执行 `git config core.hooksPath .githooks`，否则提交说明检查不会生效。

改完 Markdown 之后、提交之前，运行 `npm run format` 与 `npm run lint:md`。`format` 调用 Prettier，用来统一空格和换行；`lint:md` 调用 markdownlint，用来检查标题层级和列表写法。在编辑器里保存 Markdown 时，会按本仓库配置自动整理。编辑器建议安装的扩展写在 `.vscode/extensions.json`。

提交说明须写成 `类型(范围): 原因`，类型只能是 `docs`、`feat`、`fix` 或 `chore`。不合格的说明会被钩子拦住。

中文和英文、数字之间保留空格。需要故意不加空格时，把那几个字放进行内代码。

## 里程碑

- [ ] M1：项目骨架 + 基础计时器
- [ ] M2：公式库列表 + 静态数据
- [ ] M3：cubing.js 可视化
- [ ] M4：蓝牙适配层（先 GAN）
- [ ] M5：魔域补位 + 整体联调

## 浏览器要求

- 蓝牙功能：Chrome / Edge（桌面或 Android）
- 其他浏览器降级为手动模式
