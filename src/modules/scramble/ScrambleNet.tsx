import { useEffect, useState } from "react";
import { NET_FACES, scrambleNet, type CubeNet, type NetFace } from "./net.ts";

const FACE_NAME: Record<NetFace, string> = {
  U: "上",
  L: "左",
  F: "前",
  R: "右",
  B: "后",
  D: "下",
};

export function ScrambleNet({ moves }: { moves: string }) {
  const [net, setNet] = useState<CubeNet | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    scrambleNet(moves)
      .then((next) => {
        if (current) {
          setNet(next);
          setFailed(false);
        }
      })
      .catch(() => {
        if (current) {
          setNet(null);
          setFailed(true);
        }
      });
    return () => {
      current = false;
    };
  }, [moves]);

  if (failed) {
    return (
      <p className="scramble-net-error">平面图暂时无法显示，可以重新打乱</p>
    );
  }

  if (!net) {
    return null;
  }

  return (
    <div className="scramble-net" aria-label="打乱后的平面图，白上绿前">
      {NET_FACES.map((face) => (
        <div
          key={face}
          className="scramble-net-face"
          data-face={face}
          aria-label={`${FACE_NAME[face]}面`}
        >
          {net[face].map((color, index) => (
            <span
              key={`${face}-${index}`}
              className="scramble-sticker"
              data-color={color}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
