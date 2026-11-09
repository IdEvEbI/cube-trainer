# 调研：随机打乱蓝牙魔方 → CFOP 分步解法

状态：**调研中**（只写文档，未接入代码）。  
问题：实体已是任意合法状态时，程序能否给出 **Cross / F2L / OLL / PLL** 分段解法，并与现有蓝牙状态衔接。

## 结论摘要

| 结论                           | 说明                                                                                                                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **能否求出「能还原」的公式**   | 能。Kociemba / min2phase 类求解器对任意合法状态给出短解（非 CFOP）。                                                                                                                  |
| **能否给出「人拧 CFOP 分步」** | 能，但成熟开源选项少。当前最贴需求的是 `@moishy/cfop`（七段：`cross` + `f2l1–4` + `oll` + `pll`）。                                                                                   |
| **与蓝牙的衔接**               | 本仓已有 `facelets`（URFDLB）与 `setupAlg`（白上绿前绝对）。多数库吃**打乱公式串**或 **54 facelets**；可用 `setupAlg` 当「从复原到当前」的算法输入，或先做 facelets ↔ 库状态的转换。 |
| **建议优先级（仅调研）**       | 1）验证 `@moishy/cfop` 端到端；2）若只要「更优短解」而非 CFOP，用已依赖生态内的 min2phase / cubing search；3）`cube-solver` 仅适合 Cross 子问题。                                     |

与现有「成绩复盘状态切分」的关系：复盘是对**用户已拧序列**做阶段标注；本调研是对**当前状态**生成**建议解法**。二者互补，不是同一功能。

## 本仓可提供的输入

连接后 `requestStatus()` 可得：

- `facelets`：URFDLB 色心串（魔域 / Gan 适配层已统一）。
- `setupAlg`：从白上绿前复原到当前贴纸态的绝对算法（`faceletsToSetupAlg`）。
- 计时中还可叠加 `bluetoothStateMoves` → `joinAlgParts(setup, moves)` 得到当前绝对态。

朝向约定：打乱 / 蓝牙绝对态为**白上绿前**；练习与还原展示常为黄上。CFOP 求解器通常按「十字在底 / 顶层在上」的人拧帧工作，接入时需统一坐标系（可能要补 `z2` 等观察转体，与复盘「观察准备转体」同思路）。

---

## 方案对比

### 1. `@moishy/cfop`（moishy-cubing）

| 项       | 内容                                                                                                                                                                                            |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 分段     | **是**。七步：`cross`、`f2l1`–`f2l4`、`oll`、`pll`；输出 `segments`（含 `unitId` / `strategyId` / `cost`）与 `solutionString`。                                                                 |
| 输入     | 打乱公式字符串（SiGN / 常见面转串），`await cfop.solve(scramble)`。                                                                                                                             |
| 输出     | 人拧向 CFOP 解；按转动工效（ergonomics）择优，非绝对最短 HTM。                                                                                                                                  |
| 浏览器   | **宣称支持**（Node / Deno / Browsers；JSR + npm `0.4.0`）。                                                                                                                                     |
| 许可证   | **MIT**。                                                                                                                                                                                       |
| 接入难度 | **中**。输入若用 `setupAlg`（或打乱串）可直接试；需确认随机状态、转体记号、白上 ↔ 黄上帧。依赖 `@moishy/steps` / `cubing-core` / `algsets`。**Pre-1.0**，API 未冻结；缺 X-cross、两步 OLL 等。 |
| 评价     | **最贴近「CFOP 分步解」产品语义**；优先做 PoC 验证。                                                                                                                                            |

### 2. `cubejs`（ldez/cubejs，Kociemba）

| 项       | 内容                                                                                                                                           |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 分段     | **否**。两阶段最优近似，整串面转，无 Cross/F2L/OLL/PLL。                                                                                       |
| 输入     | `Cube` 实例：`move(alg)`、`fromString(54 facelets)`、`random()` 等。                                                                           |
| 输出     | `cube.solve()` → 单串算法（默认 ≤22 步）；可 Web Worker。                                                                                      |
| 浏览器   | **是**（含 `asyncInit` / `asyncSolve`）。                                                                                                      |
| 许可证   | **MIT**。                                                                                                                                      |
| 接入难度 | **低–中**。`fromString` 与 URFDLB facelets 接近，需核对面序与本仓 `facelets`；或 `new Cube(); cube.move(setupAlg)`。首次 `initSolver` 约数秒。 |
| 评价     | 适合「任意状态快速还原 / 更优解对照」；**不能**当 CFOP 教程分步。                                                                              |

### 3. `torjusti/cube-solver`（npm `cube-solver`）

| 项       | 内容                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| 分段     | **部分**。有 `cross` / `xcross`；另有整层 `kociemba`、以及 ZZ EOLine、Roux FB。**无完整 F2L / OLL / PLL 求解器。** |
| 输入     | 打乱串：`cubeSolver.solve(scramble, type)`。                                                                       |
| 输出     | 对应子问题的算法串。                                                                                               |
| 浏览器   | **是**（可 unpkg 全局；文档建议 Worker）。                                                                         |
| 许可证   | **MIT**。                                                                                                          |
| 接入难度 | **低**（打乱串）；整层求解偏慢。                                                                                   |
| 评价     | 可作 Cross / X-cross 教学或子模块；**不能单独满足完整 CFOP 分步。**                                                |

### 4. 其他开源

#### `freecube`（doodlewind）

- 分段：**是**（`solveCross` / `solveF2L` / `solveOLL` / `solvePLL`，`solve()` 返回四段）。
- 输入：绑在自有 `Cube` 状态上（WebGL / headless）；非标准 facelets API。
- 浏览器：是；规则型演示求解，步数与公式质量偏教学。
- 许可证：MIT。
- 接入：与本仓 Twisty / cubing.js 状态模型不同，**中–高**（需状态桥或只借算法思路）。不推荐作生产求解器。

#### `min2phase` / `min2phase.js`（及 cubing.js 内嵌）

- 分段：否（Kociemba 优化实现）。
- 本仓已依赖 `cubing`，其 search / scramble 路径即用此类求解；另有 `experimentalSolve3x3x3IgnoringCenters(pattern)`（KPattern → Alg，非 CFOP）。
- 许可证：min2phase 多为 **GPLv3 或 MIT 双许可**（选用 MIT 即可）；cubing.js 为 MPL-2.0 / GPL 可选。
- 接入：若只要短解，**最低摩擦**（状态已是 KPattern）。

#### `@andyjudson/cubify`（CubeSolverCfop）

- README 描述含 stage-annotated CFOP（cross → F2L×4 → OLL / PLL）与 Worker；MIT。
- npm 上未见稳定公开发布包名（调研时 `npm view` 无结果）；生态新、星少。可作备选跟踪，**暂不作为首选依赖**。

#### 非浏览器优先

- 各类 Python / Java CFOP 演示器、服务端求解：与「Web 客户端读蓝牙状态」目标不符，除非自建后端（prd 后置）。

---

## 对比总表

| 方案                      |       Cross       | F2L | OLL | PLL | 浏览器  |   许可证   | 与蓝牙衔接                   |
| ------------------------- | :---------------: | :-: | :-: | :-: | :-----: | :--------: | ---------------------------- |
| `@moishy/cfop`            |         ✓         | ✓×4 |  ✓  |  ✓  |    ✓    |    MIT     | 打乱/`setupAlg` 串；需验朝向 |
| `cubejs`                  | — 整层 Kociemba — |     |     |     |    ✓    |    MIT     | facelets 或 move(setup)      |
| `cube-solver`             |   ✓（+xcross）    |  ✗  |  ✗  |  ✗  |    ✓    |    MIT     | 打乱串；整层另有 kociemba    |
| `freecube`                |         ✓         |  ✓  |  ✓  |  ✓  |    ✓    |    MIT     | 自有 Cube，桥接成本高        |
| cubing min2phase / search |   — 整层短解 —    |     |     |     |    ✓    | MIT/MPL 等 | KPattern，摩擦最低           |
| andyjudson CubeSolverCfop |         ✓         |  ✓  |  ✓  |  ✓  | ✓（称） |    MIT     | 发布与成熟度待观察           |

---

## 接入难点（共用）

1. **状态表示**：蓝牙给贴纸 / setup；求解器要打乱串或自有坐标。推荐适配层：`当前绝对 alg` 或 `facelets` → 求解器状态。
2. **坐标系**：白上绿前（计时绝对）vs 黄上人拧 CFOP；解出的公式若含 `x/y/z`，需与握持展示一致。
3. **合法态**：求解器假定可达状态；蓝牙噪声 / 半转需先对表（已有 foreground resync）。
4. **产品语义**：CFOP 分步 ≠ 最短还原；「更优解」与「AI CFOP 自动还原」应分开验收。
5. **性能**：Kociemba 表初始化与 CFOP 搜索可能需 Worker，避免卡 UI。

---

## 建议的下一步（确认后再做）

1. 用固定 scramble + 本仓 `setupAlg` 对 `@moishy/cfop` 做离线 PoC（验证分段与朝向）。
2. 用同一状态跑 `cubejs` / cubing search，对比步数（短解对照，不作 CFOP）。
3. 若 PoC 通过，再开 Issue：适配层 + 复盘「建议解」展示；**不**与「公式练习蓝牙闭环」混在同一 PR。

## 参考链接

- <https://jsr.io/@moishy/cfop>
- <https://github.com/moishy-r/moishy-cubing>
- <https://github.com/ldez/cubejs>
- <https://www.npmjs.com/package/cubejs>
- <https://github.com/torjusti/cube-solver>
- <https://github.com/doodlewind/freecube>
- <https://github.com/cs0x7f/min2phase.js>
- <https://js.cubing.net/cubing/api/functions/search.experimentalSolve3x3x3IgnoringCenters.html>
