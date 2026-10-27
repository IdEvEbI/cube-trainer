import {
  ConeGeometry,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three";

export type MoveHintTone = "guide" | "error";

export type MoveHintOptions = {
  tone?: MoveHintTone;
  /** 当前是双步（R2）且尚未转完。 */
  double?: boolean;
  /** 双步已完成一半，箭头只提示剩余四分之一。 */
  half?: boolean;
};

type Face = "U" | "D" | "L" | "R" | "F" | "B";

/** 面外法向 + 面内参考「上」方向（用于建局部坐标）。 */
const FACE_FRAME: Record<
  Face,
  { normal: [number, number, number]; up: [number, number, number] }
> = {
  U: { normal: [0, 1, 0], up: [0, 0, -1] },
  D: { normal: [0, -1, 0], up: [0, 0, 1] },
  R: { normal: [1, 0, 0], up: [0, 1, 0] },
  L: { normal: [-1, 0, 0], up: [0, 1, 0] },
  F: { normal: [0, 0, 1], up: [0, 1, 0] },
  B: { normal: [0, 0, -1], up: [0, 1, 0] },
};

const FACE_TURN = /^([UDLRFB])(')?$/;

/** 接近魔域官方：半透明紫带；纠错用红。 */
const COLORS: Record<MoveHintTone, number> = {
  guide: 0xb388ff,
  error: 0xff6b6b,
};

/**
 * 对标魔域大箭头：环绕整层外轮廓，管径足够粗，手机端一目了然。
 * Twisty 三阶半宽约 0.5。
 */
const LAYER_OFFSET = 0.42;
const RING_RADIUS = 0.88;
const TUBE_RADIUS = 0.11;
const TUBE_RADIUS_DOUBLE = 0.125;
const CONE_RADIUS = 0.2;
const CONE_HEIGHT = 0.36;
const TAIL_RADIUS = 0.13;
const FLOW_COUNT = 5;
const FLOW_PERIOD_MS = 1100;

type HintHost = {
  add(object: Group): void;
  remove(object: Group): void;
  scheduleRenderCallback?: () => void;
};

type HintGroup = Group & {
  userData: {
    stopAnim?: () => void;
  };
};

/** 在 Twisty Cube3D 上挂载 / 更新 / 清除下一步旋转箭头。 */
export function applyMoveHint(
  puzzle: HintHost,
  existing: Group | null,
  move: string | null,
  options: MoveHintOptions = {},
): Group | null {
  if (existing) {
    puzzle.remove(existing);
    disposeHintGroup(existing);
  }
  if (!move) {
    puzzle.scheduleRenderCallback?.();
    return null;
  }
  const group = buildHintGroup(move, options, () => {
    puzzle.scheduleRenderCallback?.();
  });
  if (!group) {
    puzzle.scheduleRenderCallback?.();
    return null;
  }
  puzzle.add(group);
  puzzle.scheduleRenderCallback?.();
  return group;
}

function disposeHintGroup(group: Group) {
  const hint = group as HintGroup;
  hint.userData.stopAnim?.();
  hint.userData.stopAnim = undefined;
  group.traverse((obj) => {
    const mesh = obj as Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const material = mesh.material as MeshBasicMaterial | undefined;
    material?.dispose?.();
  });
}

/**
 * 大号半透明环带 + 锥头 + 沿转向递进的光点动画。
 * 组挂在 Cube3D 下，随陀螺仪 / 对齐朝向一起转（x/y/z）。
 */
function buildHintGroup(
  move: string,
  options: MoveHintOptions,
  onFrame: () => void,
): HintGroup | null {
  const match = FACE_TURN.exec(move);
  if (!match) {
    return null;
  }
  const face = match[1] as Face;
  const prime = Boolean(match[2]);
  const frame = FACE_FRAME[face];
  const tone = options.tone ?? "guide";
  const color = COLORS[tone];
  const double = Boolean(options.double) && !options.half;
  const arcLength = double ? Math.PI * 1.65 : Math.PI * 1.35;

  const normal = new Vector3(...frame.normal).normalize();
  const up = new Vector3(...frame.up).normalize();
  const right = new Vector3().crossVectors(up, normal).normalize();
  const trueUp = new Vector3().crossVectors(normal, right).normalize();

  const group = new Group() as HintGroup;
  group.name = "cube-move-hint";
  group.position.copy(normal.clone().multiplyScalar(LAYER_OFFSET));
  group.quaternion.setFromRotationMatrix(
    new Matrix4().makeBasis(right, trueUp, normal),
  );
  group.renderOrder = 10;

  const baseMaterial = new MeshBasicMaterial({
    color,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.55,
    side: DoubleSide,
  });

  const tube = double ? TUBE_RADIUS_DOUBLE : TUBE_RADIUS;
  // 从面外看法向：正转 = 顺时针。Torus 绕 +Z 右手法 = 面外看逆时针，正转镜像。
  const cw = !prime;
  const start = cw ? -Math.PI * 0.4 : Math.PI * 0.2;
  const ySign = cw ? -1 : 1;

  const torus = new TorusGeometry(RING_RADIUS, tube, 18, 80, arcLength);
  const arc = new Mesh(torus, baseMaterial);
  arc.rotation.z = start;
  arc.renderOrder = 10;
  if (cw) {
    arc.scale.y = -1;
  }
  group.add(arc);

  function pointOnArc(angle: number): Vector3 {
    return new Vector3(
      RING_RADIUS * Math.cos(angle),
      RING_RADIUS * Math.sin(angle) * ySign,
      0,
    );
  }

  function tangentOnArc(angle: number): Vector3 {
    const tangent = new Vector3(
      -Math.sin(angle) * ySign,
      Math.cos(angle),
      0,
    ).normalize();
    if (cw) {
      tangent.negate();
    }
    return tangent;
  }

  const tipAngle = cw ? start - arcLength : start + arcLength;
  const tip = new Mesh(
    new ConeGeometry(CONE_RADIUS, CONE_HEIGHT, 22),
    new MeshBasicMaterial({
      color,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.95,
      side: DoubleSide,
    }),
  );
  tip.renderOrder = 12;
  tip.position.copy(pointOnArc(tipAngle));
  tip.quaternion.setFromUnitVectors(
    new Vector3(0, 1, 0),
    tangentOnArc(tipAngle),
  );
  group.add(tip);

  // 尾端圆点（对标魔域箭头尾）
  const tailAngle = start;
  const tail = new Mesh(
    new SphereGeometry(TAIL_RADIUS, 16, 16),
    new MeshBasicMaterial({
      color,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.9,
      side: DoubleSide,
    }),
  );
  tail.renderOrder = 12;
  tail.position.copy(pointOnArc(tailAngle));
  group.add(tail);

  if (double) {
    const midAngle = cw ? start - arcLength * 0.5 : start + arcLength * 0.5;
    const mid = new Mesh(
      new ConeGeometry(CONE_RADIUS * 0.72, CONE_HEIGHT * 0.72, 18),
      new MeshBasicMaterial({
        color,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: 0.9,
        side: DoubleSide,
      }),
    );
    mid.renderOrder = 12;
    mid.position.copy(pointOnArc(midAngle));
    mid.quaternion.setFromUnitVectors(
      new Vector3(0, 1, 0),
      tangentOnArc(midAngle),
    );
    group.add(mid);
  }

  // 递进光点：沿转向方向追逐，提示旋转方向
  const flowMeshes: Mesh[] = [];
  const flowMats: MeshBasicMaterial[] = [];
  for (let i = 0; i < FLOW_COUNT; i += 1) {
    const mat = new MeshBasicMaterial({
      color,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.2,
      side: DoubleSide,
    });
    const bead = new Mesh(new SphereGeometry(tube * 1.15, 12, 12), mat);
    bead.renderOrder = 13;
    group.add(bead);
    flowMeshes.push(bead);
    flowMats.push(mat);
  }

  const startedAt = performance.now();
  let raf = 0;
  const hasRaf = typeof requestAnimationFrame === "function";
  const tick = (now: number) => {
    const phase = ((now - startedAt) / FLOW_PERIOD_MS) % 1;
    for (let i = 0; i < FLOW_COUNT; i += 1) {
      // 光点沿弧从尾到头递进；错开相位形成拖尾
      const local = (phase + i / FLOW_COUNT) % 1;
      const angle = cw ? start - arcLength * local : start + arcLength * local;
      const bead = flowMeshes[i]!;
      const mat = flowMats[i]!;
      bead.position.copy(pointOnArc(angle));
      // 靠近箭头头部更亮
      mat.opacity = 0.25 + 0.7 * local;
      const scale = 0.75 + 0.55 * local;
      bead.scale.setScalar(scale);
    }
    onFrame();
    if (hasRaf) {
      raf = requestAnimationFrame(tick);
    }
  };
  if (hasRaf) {
    raf = requestAnimationFrame(tick);
    group.userData.stopAnim = () => {
      cancelAnimationFrame(raf);
    };
  } else {
    // Node 单测无 rAF：摆一帧静态光点即可
    tick(startedAt);
  }

  return group;
}
