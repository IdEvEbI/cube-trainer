import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
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

/**
 * 面外法向 = 转动轴。
 * 方案 A：无填充描边框套住该层 + 四边各一短白箭头同步沿边循环。
 */
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

/** 箭头主色。 */
const FILL_COLORS: Record<MoveHintTone, number> = {
  guide: 0xffffff,
  error: 0xff5a52,
};

/** 描边框主色（引导近白，纠错红）。 */
const FRAME_COLORS: Record<MoveHintTone, number> = {
  guide: 0xf4f7fb,
  error: 0xff5a52,
};

export const MOVE_HINT_CUBE_EDGE = 3;
export const MOVE_HINT_CUBE_RADIUS = 1.5;
/** 描边框面宽：略抬出贴纸。 */
export const MOVE_HINT_LAYER_FACE = MOVE_HINT_CUBE_EDGE + 0.18;
/** 箭头贴在框四侧外壁。 */
export const MOVE_HINT_SIDE_LIFT = 0.04;
export const MOVE_HINT_RING_RADIUS =
  MOVE_HINT_LAYER_FACE / 2 + MOVE_HINT_SIDE_LIFT;
/** 提示组贴在面对外一侧。 */
export const MOVE_HINT_LAYER_OFFSET = MOVE_HINT_CUBE_RADIUS + 0.1;
/** 描边棱半宽。 */
export const MOVE_HINT_FRAME_HALF = 0.032;
/** 小箭头半宽。 */
export const MOVE_HINT_ARROW_HALF_WIDTH = 0.0825;
/** 小箭头半长（含更长尾部）。 */
export const MOVE_HINT_ARROW_HALF_LEN = 0.39;
/** 一边跑完耗时（毫秒）。 */
export const MOVE_HINT_SIDE_MS = 1600;

const LAYER_THICK = 1.14;
const FRAME_OPACITY = 0.92;
const SIDE_ANGLES = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2] as const;

type HintHost = {
  add(object: Group): void;
  remove(object: Group): void;
  scheduleRenderCallback?: () => void;
};

type HintGroup = Group & {
  userData: {
    stopAnim?: () => void;
    face?: Face;
    ringRadius?: number;
    depthTest?: boolean;
    double?: boolean;
    fillColor?: number;
    sideMs?: number;
    arrowCount?: number;
  };
};

function solidMaterial(
  color: number,
  opacity: number,
  depthTest: boolean,
): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color,
    depthTest,
    depthWrite: false,
    transparent: true,
    opacity,
    side: DoubleSide,
  });
}

/** 小箭头：尖头 + 加长尾，本地 +Y 为指向。 */
function createArrowGeometry(
  halfWidth: number,
  halfLen: number,
): BufferGeometry {
  const w = halfWidth;
  const bodyH = halfLen * 0.72;
  const headH = halfLen * 0.48;
  const headW = halfWidth * 2.05;
  const neck = bodyH * 0.05;
  const positions = new Float32Array([
    -w * 0.3,
    -bodyH,
    0,
    w * 0.3,
    -bodyH,
    0,
    w * 0.34,
    neck,
    0,
    -w * 0.3,
    -bodyH,
    0,
    w * 0.34,
    neck,
    0,
    -w * 0.34,
    neck,
    0,
    0,
    neck + headH,
    0,
    -headW,
    neck,
    0,
    headW,
    neck,
    0,
  ]);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function sideBasis(
  angle: number,
  travelSign: number,
): {
  radial: Vector3;
  tangent: Vector3;
  binormal: Vector3;
} {
  const radial = new Vector3(Math.cos(angle), Math.sin(angle), 0).normalize();
  const tangent = new Vector3(
    -Math.sin(angle) * travelSign,
    Math.cos(angle) * travelSign,
    0,
  ).normalize();
  const binormal = new Vector3().crossVectors(tangent, radial).normalize();
  return { radial, tangent, binormal };
}

function applySidePose(
  target: Object3D,
  angle: number,
  travelSign: number,
  radius: number,
  along: number,
  halfSide: number,
) {
  const { radial, tangent, binormal } = sideBasis(angle, travelSign);
  target.position
    .copy(radial)
    .multiplyScalar(radius)
    .addScaledVector(tangent, along * halfSide);
  target.quaternion.setFromRotationMatrix(
    new Matrix4().makeBasis(binormal, tangent, radial),
  );
}

/** 12 条棱组成的空心描边框（无填充，不洗贴纸色）。 */
function buildLayerFrame(
  face: number,
  thick: number,
  color: number,
  opacity: number,
  depthTest: boolean,
): Group {
  const frame = new Group();
  frame.name = "cube-move-hint-layer";
  const hf = face / 2;
  const ht = thick / 2;
  const bar = MOVE_HINT_FRAME_HALF * 2;
  const material = solidMaterial(color, opacity, depthTest);

  type Spec = {
    size: [number, number, number];
    pos: [number, number, number];
  };
  const specs: Spec[] = [
    // 外圈（+Z）
    { size: [face, bar, bar], pos: [0, hf, ht] },
    { size: [face, bar, bar], pos: [0, -hf, ht] },
    { size: [bar, face, bar], pos: [hf, 0, ht] },
    { size: [bar, face, bar], pos: [-hf, 0, ht] },
    // 内圈（-Z）
    { size: [face, bar, bar], pos: [0, hf, -ht] },
    { size: [face, bar, bar], pos: [0, -hf, -ht] },
    { size: [bar, face, bar], pos: [hf, 0, -ht] },
    { size: [bar, face, bar], pos: [-hf, 0, -ht] },
    // 四角立柱
    { size: [bar, bar, thick], pos: [hf, hf, 0] },
    { size: [bar, bar, thick], pos: [hf, -hf, 0] },
    { size: [bar, bar, thick], pos: [-hf, hf, 0] },
    { size: [bar, bar, thick], pos: [-hf, -hf, 0] },
  ];

  for (const spec of specs) {
    const mesh = new Mesh(new BoxGeometry(...spec.size), material);
    mesh.position.set(...spec.pos);
    mesh.renderOrder = 18;
    frame.add(mesh);
  }
  return frame;
}

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
 * 空心描边框 + 四边各一短白箭头，同步沿各自边循环。
 * 本地系：Z 朝外法向，XY 为层平面。
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
  const fillColor = FILL_COLORS[tone];
  const frameColor = FRAME_COLORS[tone];
  const double = Boolean(options.double) && !options.half;
  const half = Boolean(options.half);
  const travelSign = prime ? 1 : -1;

  const normal = new Vector3(...frame.normal).normalize();
  const up = new Vector3(...frame.up).normalize();
  const right = new Vector3().crossVectors(up, normal).normalize();
  const trueUp = new Vector3().crossVectors(normal, right).normalize();

  const ringRadius = MOVE_HINT_RING_RADIUS;
  const layerOffset = MOVE_HINT_LAYER_OFFSET;
  const halfSide = MOVE_HINT_LAYER_FACE / 2;
  const layerZ = MOVE_HINT_CUBE_RADIUS - LAYER_THICK / 2 - layerOffset;
  const sideMs = double ? MOVE_HINT_SIDE_MS * 0.8 : MOVE_HINT_SIDE_MS;

  const group = new Group() as HintGroup;
  group.name = "cube-move-hint";
  group.userData.face = face;
  group.position.copy(normal.clone().multiplyScalar(layerOffset));
  group.quaternion.setFromRotationMatrix(
    new Matrix4().makeBasis(right, trueUp, normal),
  );
  group.renderOrder = 20;

  const depthTest = true;

  const layer = buildLayerFrame(
    MOVE_HINT_LAYER_FACE,
    LAYER_THICK,
    frameColor,
    FRAME_OPACITY,
    depthTest,
  );
  layer.position.z = layerZ;
  group.add(layer);

  const belt = new Group();
  belt.name = "cube-move-hint-arrow";
  belt.position.z = layerZ;
  belt.renderOrder = 22;

  const activeAngles = half
    ? ([0, Math.PI] as number[])
    : ([...SIDE_ANGLES] as number[]);

  const arrowGeom = createArrowGeometry(
    MOVE_HINT_ARROW_HALF_WIDTH,
    MOVE_HINT_ARROW_HALF_LEN,
  );
  const outlineGeom = createArrowGeometry(
    MOVE_HINT_ARROW_HALF_WIDTH * 1.28,
    MOVE_HINT_ARROW_HALF_LEN * 1.1,
  );
  const travelers: Group[] = [];
  for (let i = 0; i < activeAngles.length; i++) {
    const traveler = new Group();
    traveler.name =
      i === 0 ? "cube-move-hint-traveler" : `cube-move-hint-traveler-${i}`;
    const outline = new Mesh(
      outlineGeom,
      solidMaterial(0x2a5078, 0.55, depthTest),
    );
    outline.position.z = -0.001;
    outline.renderOrder = 23;
    traveler.add(outline);
    const head = new Mesh(arrowGeom, solidMaterial(fillColor, 0.98, depthTest));
    head.name = i === 0 ? "cube-move-hint-head" : `cube-move-hint-head-${i}`;
    head.renderOrder = 24;
    traveler.add(head);
    belt.add(traveler);
    travelers.push(traveler);
  }
  group.add(belt);

  group.userData.ringRadius = ringRadius;
  group.userData.depthTest = depthTest;
  group.userData.double = double;
  group.userData.fillColor = fillColor;
  group.userData.sideMs = sideMs;
  group.userData.arrowCount = travelers.length;

  const startedAt = performance.now();
  let raf = 0;
  const hasRaf = typeof requestAnimationFrame === "function";
  const tick = (now: number) => {
    const elapsed = now - startedAt;
    // 四边同步：各自在本边上 -1→+1 循环，周期 = 一边耗时
    const along = ((elapsed / sideMs) % 1) * 2 - 1;
    for (let i = 0; i < travelers.length; i++) {
      applySidePose(
        travelers[i]!,
        activeAngles[i]!,
        travelSign,
        ringRadius + 0.01,
        along,
        halfSide * 0.88,
      );
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
    tick(startedAt);
  }

  return group;
}
