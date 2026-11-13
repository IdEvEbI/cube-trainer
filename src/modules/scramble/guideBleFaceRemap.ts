/**
 * 首页打乱引导与游戏页跟拧共用的 BLE 面转映面。
 *
 * 约定（L9）：
 * - 映面朝向 = 公式已完成转体 + 相对 home 的实况 Δ（勿死叠层转期望 Δ 为唯一依据）
 * - 游戏黄上：relative 的 home 用**公式转体姿态**（避免 live home 仍白上时 z2 双计 → U 认成 D）
 * - 回退链：match → 相对 Δ 取反 → 仅公式 → 可选层转期望 Δ
 * - 色心已对上期望则不映（{@link resolveGuideBleFaceMove}）
 *
 * 首页打乱：formulaOrients 常为空，basis=开局 live home。
 * 游戏还原：formulaOrients 含 z2；层转倾斜进 relative。
 */

import { IDENTITY_QUAT, type MoyuQuat } from "../bluetooth/moyu/orientation.ts";
import { relativeOrientationAlg } from "../game/guideOrientation.ts";
import {
  invertRotationGuideToken,
  quatFromOrientationAlg,
} from "../score/cubeOrientation.ts";
import { resolveGuideBleFaceMove } from "./layerGuideDualPaint.ts";

export type GuideFaceRemapHomeState = {
  homeQuat: MoyuQuat;
  /** 上次写入 home 时的公式转体键；无黄上时为 ""。 */
  orientsKey: string;
  /** 键已变但当时无 live，等下一帧陀螺写入。 */
  pendingKey: string | null;
};

export function createGuideFaceRemapHomeState(
  homeQuat: MoyuQuat = IDENTITY_QUAT,
): GuideFaceRemapHomeState {
  return {
    homeQuat,
    orientsKey: "",
    pendingKey: null,
  };
}

/** 开局 / 对齐：home 吸成当前 live（首页打乱引导起点）。 */
export function captureGuideFaceRemapHome(
  liveQuat: MoyuQuat,
  orientsKey = "",
): GuideFaceRemapHomeState {
  return {
    homeQuat: liveQuat,
    orientsKey,
    pendingKey: null,
  };
}

export function clearGuideFaceRemapHome(): GuideFaceRemapHomeState {
  return createGuideFaceRemapHomeState(IDENTITY_QUAT);
}

/**
 * 公式转体键变化时更新 home。
 * `active=false`（尚无 z2 等）时清零，避免打乱段误用黄上基准。
 */
export function syncGuideFaceRemapHome(
  state: GuideFaceRemapHomeState,
  options: {
    orientsKey: string;
    active: boolean;
    liveQuat: MoyuQuat | null;
  },
): GuideFaceRemapHomeState {
  if (!options.active) {
    return clearGuideFaceRemapHome();
  }
  if (options.orientsKey === state.orientsKey) {
    return state;
  }
  if (options.liveQuat) {
    return {
      homeQuat: options.liveQuat,
      orientsKey: options.orientsKey,
      pendingKey: null,
    };
  }
  return {
    ...state,
    orientsKey: options.orientsKey,
    pendingKey: options.orientsKey,
  };
}

/** 陀螺到达：兑现 pending home。 */
export function applyGuideFaceRemapHomeLive(
  state: GuideFaceRemapHomeState,
  liveQuat: MoyuQuat,
): GuideFaceRemapHomeState {
  if (state.pendingKey === null || state.pendingKey !== state.orientsKey) {
    return state;
  }
  return {
    homeQuat: liveQuat,
    orientsKey: state.orientsKey,
    pendingKey: null,
  };
}

/** `x y'` → `y x'`。 */
export function invertOrientationAlgParts(alg: string): string {
  const tokens = alg
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      try {
        return invertRotationGuideToken(token);
      } catch {
        return token;
      }
    });
  return tokens.reverse().join(" ");
}

/**
 * 拼 match 朝向词：公式转体 + 相对 Δ。
 */
export function composeGuideBleMatchOrients(
  formulaOrients: readonly string[],
  relativeFromHomeAlg: string | null | undefined,
): string[] {
  const formula = [...formulaOrients];
  const rel = (relativeFromHomeAlg ?? "").trim();
  if (!rel) {
    return formula;
  }
  return [...formula, ...rel.split(/\s+/).filter(Boolean)];
}

/**
 * relative 的基准姿态：
 * - 有公式转体（游戏黄上）：用公式姿态，避免 live home 未跟上 z2 时双计；
 * - 无公式转体（首页打乱）：用开局 captured home。
 */
export function guideBleRelativeBasisQuat(
  formulaOrients: readonly string[],
  capturedHomeQuat: MoyuQuat,
): MoyuQuat {
  if (formulaOrients.length === 0) {
    return capturedHomeQuat;
  }
  return quatFromOrientationAlg(formulaOrients.join(" "));
}

/**
 * 公式转体 + relative(basis→live) → 映面朝向词表。
 */
export function guideBleMatchOrientations(
  formulaOrients: readonly string[],
  homeQuat: MoyuQuat,
  liveQuat: MoyuQuat | null | undefined,
): string[] {
  if (!liveQuat) {
    return [...formulaOrients];
  }
  const basis = guideBleRelativeBasisQuat(formulaOrients, homeQuat);
  return composeGuideBleMatchOrients(
    formulaOrients,
    relativeOrientationAlg(basis, liveQuat),
  );
}

/** 同上，空格串。 */
export function guideBleFaceOrientAlg(
  formulaOrients: readonly string[],
  homeQuat: MoyuQuat,
  liveQuat: MoyuQuat | null | undefined,
): string {
  return guideBleMatchOrientations(formulaOrients, homeQuat, liveQuat).join(
    " ",
  );
}

/**
 * 映面候选（去重，按优先级）：
 * 1. 公式 + relative(basis→live)
 * 2. 公式 + relative 取反（陀螺/吸附把 r' 的 x 认成 x' 时）
 * 3. 仅公式（摆正兜底）
 *
 * 不要把「已完成层转期望 Δ 全历史」塞进候选：`S' … S … d'` 会拼成
 * `z' z y'`，失败时把 B' 映成 L' 并误报「请转 L」。
 */
export function guideBleFaceOrientCandidates(options: {
  formulaOrients: readonly string[];
  homeQuat: MoyuQuat;
  liveQuat: MoyuQuat | null | undefined;
  /** @deprecated 忽略；保留参数以免旧调用方立刻报错。 */
  layerGyroAlg?: string | null;
}): string[] {
  const formula = options.formulaOrients;
  const formulaAlg = formula.join(" ").trim();
  const out: string[] = [];
  const push = (alg: string) => {
    const trimmed = alg.trim();
    // 允许空串（打乱段绝对面）；非空去重。
    if (trimmed === "") {
      if (!out.includes("")) {
        out.push("");
      }
      return;
    }
    if (!out.includes(trimmed)) {
      out.push(trimmed);
    }
  };

  if (options.liveQuat) {
    const basis = guideBleRelativeBasisQuat(formula, options.homeQuat);
    const rel = relativeOrientationAlg(basis, options.liveQuat);
    push(composeGuideBleMatchOrients(formula, rel).join(" "));
    const inv = invertOrientationAlgParts(rel);
    if (inv && inv !== rel.trim()) {
      push(composeGuideBleMatchOrients(formula, inv).join(" "));
    }
  }
  if (formulaAlg) {
    push(formulaAlg);
  } else if (out.length === 0) {
    push("");
  }
  if (out.length === 0) {
    out.push("");
  }
  return out;
}

/**
 * BLE 色心面转 → 公式帧：按候选朝向依次试，命中期望即停。
 * 保留两参 hint 形式：match + hint 映射到候选表前两项逻辑。
 */
export function resolveGuideBleFaceMoveWithHint(
  bleMove: string,
  expectedToken: string | null | undefined,
  matchOrientAlg: string,
  hintOrientAlg: string = matchOrientAlg,
): string {
  const candidates = [matchOrientAlg, hintOrientAlg]
    .map((alg) => alg.trim())
    .filter((alg, index, all) => all.indexOf(alg) === index);
  return resolveGuideBleFaceMoveWithCandidates(
    bleMove,
    expectedToken,
    candidates,
  );
}

export function resolveGuideBleFaceMoveWithCandidates(
  bleMove: string,
  expectedToken: string | null | undefined,
  orientAlgs: readonly string[],
): string {
  const want = (expectedToken ?? "").trim();
  const list = orientAlgs.length > 0 ? orientAlgs : [""];
  // 无一命中时回落**首个**候选的映面（勿用末个：层转期望 Δ 会把 B' 收成 L'）。
  let first: string | null = null;
  for (const alg of list) {
    const got = resolveGuideBleFaceMove(bleMove, expectedToken, alg);
    if (first === null) {
      first = got;
    }
    if (!want || got === want) {
      return got;
    }
  }
  return first ?? bleMove.trim();
}

export { resolveGuideBleFaceMove };
