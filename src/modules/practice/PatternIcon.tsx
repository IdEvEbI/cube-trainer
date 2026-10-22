import type { PatternPaint, TopSticker } from "./pattern.ts";
import "./practice.css";

/** 与常见 OLL/PLL 识别图一致：中间 3×3 顶层 + 四周侧面条；PLL 可叠箭头。 */
const CELL = 12;
const GAP = 2;
const BAR = 4;
const PAD = 1;
const GRID = 3 * CELL + 2 * GAP;
const VIEW = PAD + BAR + GAP + GRID + GAP + BAR + PAD;
const GRID_ORIGIN = PAD + BAR + GAP;

function paintFill(paint: PatternPaint): string {
  switch (paint) {
    case "黄":
      return "var(--oll-oriented, #ffd500)";
    case "绿":
      return "var(--oll-green, #009b48)";
    case "蓝":
      return "var(--oll-blue, #0045ad)";
    case "红":
      return "var(--oll-red, #b71234)";
    case "橙":
      return "var(--oll-orange, #ff5800)";
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

export function PatternIcon({
  top,
  sides = [],
  arrows = [],
  label,
  large = false,
  size = large ? "hint" : "list",
}: {
  top: readonly TopSticker[];
  sides?: readonly TopSticker[];
  arrows?: readonly (readonly [number, number])[];
  label: string;
  large?: boolean;
  size?: "list" | "card" | "hint";
}) {
  const parts = arrowParts(arrows);
  return (
    <svg
      className={`top-pattern is-${size}`}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
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
