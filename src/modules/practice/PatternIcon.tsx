import type { CubeFaces, PatternPaint, TopSticker } from "./pattern.ts";
import "./practice.css";

/** OLL/PLL：顶层 3×3 + 侧面条；F2L：GAN 风格立体 U/F/R。 */
const CELL = 12;
const GAP = 2;
const BAR = 4;
const PAD = 1;
const GRID = 3 * CELL + 2 * GAP;
const BASE = PAD + BAR + GAP + GRID + GAP + BAR + PAD;
const GRID_ORIGIN = PAD + BAR + GAP;

/** 等距立方体：单位边长 3，屏幕投影 (i−j, i+j, −k)。竖向加高，接近立方体观感。 */
const ISO_SX = 9.5;
const ISO_SY = 5.4;
const ISO_SZ = 12.6;
const ISO_OX = 34;
const ISO_OY = 40;
const ISO_W = 68;
const ISO_H = 78;
const ISO_INSET = 0.12;
const ISO_PLASTIC = "#1c1f26";

function paintFill(paint: PatternPaint, face?: "U" | "F" | "R"): string {
  switch (paint) {
    case "黄":
      return "var(--oll-oriented, #ffff00)";
    case "白":
      return "var(--oll-white, #ffffff)";
    case "绿":
      return "var(--oll-green, #32cd32)";
    case "蓝":
      return "var(--oll-blue, #2266ff)";
    case "红":
      return "var(--oll-red, #ff0000)";
    case "橙":
      return "var(--oll-orange, #ffa500)";
    case "灰":
      if (face === "U") {
        return "var(--f2l-dim-u, #c8ccd4)";
      }
      if (face === "F") {
        return "var(--f2l-dim-f, #a6abb4)";
      }
      if (face === "R") {
        return "var(--f2l-dim-r, #8b909a)";
      }
      return "var(--oll-dim, #9aa0a8)";
    default:
      return "var(--oll-unoriented, #0a0a0a)";
  }
}

function barRect(
  index: number,
  sticker: PatternPaint,
): {
  key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sticker: PatternPaint;
} {
  const col = index % 3;
  const along = CELL;
  if (index < 3) {
    return {
      key: `t${col}`,
      x: GRID_ORIGIN + col * (CELL + GAP),
      y: PAD,
      width: along,
      height: BAR,
      sticker,
    };
  }
  if (index < 6) {
    const i = index - 3;
    return {
      key: `r${i}`,
      x: GRID_ORIGIN + GRID + GAP,
      y: GRID_ORIGIN + i * (CELL + GAP),
      width: BAR,
      height: along,
      sticker,
    };
  }
  if (index < 9) {
    const i = index - 6;
    return {
      key: `b${i}`,
      x: GRID_ORIGIN + i * (CELL + GAP),
      y: GRID_ORIGIN + GRID + GAP,
      width: along,
      height: BAR,
      sticker,
    };
  }
  const i = index - 9;
  return {
    key: `l${i}`,
    x: PAD,
    y: GRID_ORIGIN + i * (CELL + GAP),
    width: BAR,
    height: along,
    sticker,
  };
}

function cellCenter(index: number): { x: number; y: number } {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return {
    x: GRID_ORIGIN + col * (CELL + GAP) + CELL / 2,
    y: GRID_ORIGIN + row * (CELL + GAP) + CELL / 2,
  };
}

function pairKey(from: number, to: number): string {
  return from < to ? `${from}-${to}` : `${to}-${from}`;
}

type ArrowParts = {
  key: string;
  shaft: string;
  heads: string[];
};

function arrowParts(
  arrows: readonly (readonly [number, number])[],
): ArrowParts[] {
  const seen = new Set<string>();
  const parts: ArrowParts[] = [];
  for (const [from, to] of arrows) {
    const key = pairKey(from, to);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const reverse = arrows.some(([a, b]) => a === to && b === from);
    const a = cellCenter(from);
    const b = cellCenter(to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const inset = CELL * 0.22;
    const head = 3.2;
    const wing = 2.1;
    const x1 = a.x + ux * inset;
    const y1 = a.y + uy * inset;
    const x2 = b.x - ux * inset;
    const y2 = b.y - uy * inset;
    const px = -uy;
    const py = ux;
    const tipAt = (x: number, y: number, dir: 1 | -1) =>
      `M ${x} ${y} L ${x - dir * ux * head + px * wing} ${y - dir * uy * head + py * wing} L ${x - dir * ux * head - px * wing} ${y - dir * uy * head - py * wing} Z`;
    const heads = [tipAt(x2, y2, 1)];
    if (reverse) {
      heads.push(tipAt(x1, y1, -1));
    }
    parts.push({
      key,
      shaft: `M ${x1} ${y1} L ${x2} ${y2}`,
      heads,
    });
  }
  return parts;
}

function pts(points: readonly (readonly [number, number])[]): string {
  return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");
}

function project(i: number, j: number, k: number): [number, number] {
  return [ISO_OX + (i - j) * ISO_SX, ISO_OY + (i + j) * ISO_SY - k * ISO_SZ];
}

function insetQuad(
  points: readonly (readonly [number, number])[],
  amount: number,
): [number, number][] {
  const cx = points.reduce((sum, [x]) => sum + x, 0) / points.length;
  const cy = points.reduce((sum, [, y]) => sum + y, 0) / points.length;
  return points.map(([x, y]) => [x + (cx - x) * amount, y + (cy - y) * amount]);
}

/** 等距投影：U 在上、F 左前、R 右前；三面共边对齐。 */
function isoPoly(
  face: "U" | "F" | "R",
  row: number,
  col: number,
): [number, number][] {
  if (face === "U") {
    return [
      project(col, row, 3),
      project(col + 1, row, 3),
      project(col + 1, row + 1, 3),
      project(col, row + 1, 3),
    ];
  }
  if (face === "F") {
    return [
      project(col, 3, 3 - row),
      project(col + 1, 3, 3 - row),
      project(col + 1, 3, 2 - row),
      project(col, 3, 2 - row),
    ];
  }
  // R：col 0 靠前（贴 F），col 2 靠后
  return [
    project(3, 3 - col, 3 - row),
    project(3, 2 - col, 3 - row),
    project(3, 2 - col, 2 - row),
    project(3, 3 - col, 2 - row),
  ];
}

function CubeIcon({
  cube,
  label,
  size,
}: {
  cube: CubeFaces;
  label: string;
  size: "list" | "card" | "hint";
}) {
  // 先 F/R 再 U，保证顶面盖住侧面上沿
  const faces: ("U" | "F" | "R")[] = ["F", "R", "U"];
  const shells: Record<"U" | "F" | "R", [number, number][]> = {
    U: [project(0, 0, 3), project(3, 0, 3), project(3, 3, 3), project(0, 3, 3)],
    F: [project(0, 3, 3), project(3, 3, 3), project(3, 3, 0), project(0, 3, 0)],
    R: [project(3, 3, 3), project(3, 0, 3), project(3, 0, 0), project(3, 3, 0)],
  };
  return (
    <svg
      className={`top-pattern is-cube is-${size}`}
      viewBox={`0 0 ${ISO_W} ${ISO_H}`}
      role="img"
      aria-label={label}
    >
      {faces.map((face) => (
        <polygon
          key={`shell-${face}`}
          className="top-pattern-iso-shell"
          points={pts(shells[face])}
          fill={ISO_PLASTIC}
        />
      ))}
      {faces.flatMap((face) =>
        cube[face].map((sticker, index) => {
          const row = Math.floor(index / 3);
          const col = index % 3;
          return (
            <polygon
              key={`${face}${index}`}
              className="top-pattern-iso"
              points={pts(insetQuad(isoPoly(face, row, col), ISO_INSET))}
              fill={paintFill(sticker, face)}
              data-sticker={sticker}
              data-face={face}
            />
          );
        }),
      )}
    </svg>
  );
}

export function PatternIcon({
  top,
  sides = [],
  arrows = [],
  cube,
  label,
  large = false,
  size = large ? "hint" : "list",
}: {
  top: readonly TopSticker[];
  sides?: readonly TopSticker[];
  arrows?: readonly (readonly [number, number])[];
  cube?: CubeFaces;
  label: string;
  large?: boolean;
  size?: "list" | "card" | "hint";
}) {
  if (cube) {
    return <CubeIcon cube={cube} label={label} size={size} />;
  }

  const parts = arrowParts(arrows);
  return (
    <svg
      className={`top-pattern is-${size}`}
      viewBox={`0 0 ${BASE} ${BASE}`}
      role="img"
      aria-label={label}
    >
      <rect
        className="top-pattern-frame"
        x={GRID_ORIGIN - GAP / 2}
        y={GRID_ORIGIN - GAP / 2}
        width={GRID + GAP}
        height={GRID + GAP}
        rx={1}
      />
      {top.map((sticker, index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        return (
          <rect
            key={`c${index}`}
            className="top-pattern-cell"
            x={GRID_ORIGIN + col * (CELL + GAP)}
            y={GRID_ORIGIN + row * (CELL + GAP)}
            width={CELL}
            height={CELL}
            fill={paintFill(sticker)}
            data-sticker={sticker}
          />
        );
      })}
      {sides.map((sticker, index) => {
        const bar = barRect(index, sticker);
        return (
          <rect
            key={bar.key}
            className="top-pattern-bar"
            x={bar.x}
            y={bar.y}
            width={bar.width}
            height={bar.height}
            rx={0.5}
            fill={paintFill(bar.sticker)}
            data-sticker={bar.sticker}
          />
        );
      })}
      {parts.map((part) => (
        <g key={part.key} className="top-pattern-arrow">
          <path className="top-pattern-arrow-halo" d={part.shaft} />
          <path className="top-pattern-arrow-shaft" d={part.shaft} />
          {part.heads.map((head, index) => (
            <path
              key={`${part.key}-h${index}`}
              className="top-pattern-arrow-head"
              d={head}
            />
          ))}
        </g>
      ))}
    </svg>
  );
}
