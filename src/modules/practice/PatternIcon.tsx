import type { TopSticker } from "./pattern.ts";
import "./practice.css";

export function PatternIcon({
  top,
  label,
  large = false,
  size = large ? "hint" : "list",
}: {
  top: readonly TopSticker[];
  label: string;
  large?: boolean;
  size?: "list" | "card" | "hint";
}) {
  return (
    <span className={`top-pattern is-${size}`} role="img" aria-label={label}>
      {top.map((sticker, index) => (
        <span key={index} data-sticker={sticker} />
      ))}
    </span>
  );
}
