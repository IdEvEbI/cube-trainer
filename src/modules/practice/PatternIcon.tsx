import type { TopSticker } from "./pattern.ts";
import "./practice.css";

export function PatternIcon({
  top,
  label,
  large = false,
}: {
  top: readonly TopSticker[];
  label: string;
  large?: boolean;
}) {
  return (
    <span
      className={large ? "top-pattern is-large" : "top-pattern"}
      role="img"
      aria-label={label}
    >
      {top.map((sticker, index) => (
        <span key={index} data-sticker={sticker} />
      ))}
    </span>
  );
}
