import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
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

/** 面转四分之一；双步由 options.double 表示（与首页引导一致）。 */
const FACE_TURN = /^([UDLRFB])(')?$/;
/** 整机转体：画在对应轴朝向的面上（x→R，y→U，z→F）。 */
const ROTATION_TURN = /^([xyz])(2'|2|')?$/;
const ROTATION_AXIS_FACE: Record<"x" | "y" | "z", Face> = {
  x: "R",
  y: "U",
  z: "F",
};

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
/**
 * 整机转体描边：比立方体外沿再放宽一圈，避免 z2 等盒子比魔方窄一截。
 */
export const MOVE_HINT_WHOLE_FACE = MOVE_HINT_CUBE_EDGE + 0.42;
/** 中层描边：再放大一圈，避免框陷在贴纸内侧看不见。 */
export const MOVE_HINT_MIDDLE_FACE = MOVE_HINT_CUBE_EDGE + 0.5;
/** 箭头贴在框四侧外壁。 */
export const MOVE_HINT_SIDE_LIFT = 0.04;
export const MOVE_HINT_RING_RADIUS =
  MOVE_HINT_LAYER_FACE / 2 + MOVE_HINT_SIDE_LIFT;
export const MOVE_HINT_WHOLE_RING_RADIUS =
  MOVE_HINT_WHOLE_FACE / 2 + MOVE_HINT_SIDE_LIFT;
export const MOVE_HINT_MIDDLE_RING_RADIUS =
  MOVE_HINT_MIDDLE_FACE / 2 + MOVE_HINT_SIDE_LIFT;
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
/**
 * 箭头沿边行程半长：各层种类统一按单层外框，保证轨迹长度与线速度一致。
 * （整机描边略大，若按自身 faceSize 算，同样周期会显得更快。）
 */
export const MOVE_HINT_TRAVEL_HALF = (MOVE_HINT_LAYER_FACE / 2) * 0.88;

const LAYER_THICK_OUTER = 1.14;
/** 宽层约两层厚。 */
const LAYER_THICK_WIDE = 2.28;
const LAYER_THICK_MIDDLE = 1.14;
/** 整机转体：厚度覆盖整颗魔方。 */
const LAYER_THICK_WHOLE = MOVE_HINT_WHOLE_FACE;
const FRAME_OPACITY = 0.92;
const SIDE_ANGLES = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2] as const;

type HintLayerKind = "outer" | "wide" | "middle" | "whole";

type HintHost = {
  add(object: Group): void;
  remove(object: Group): void;
  scheduleRenderCallback?: () => void;
};

type HintGroup = Group & {
  userData: {
    stopAnim?: () => void;
    face?: Face;
    layerKind?: HintLayerKind;
    ringRadius?: number;
    depthTest?: boolean;
    double?: boolean;
    fillColor?: number;
    sideMs?: number;
    /** 箭头总枚数（各排合计）。 */
    arrowCount?: number;
    /** 沿转轴方向的箭头排数：单层 1、宽层 2、整机 3。 */
    arrowBeltCount?: number;
    /** 沿边行程半长（与单层一致）。 */
    travelHalf?: number;
    hintMove?: string;
    hintOptionsKey?: string;
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

function hintOptionsKey(options: MoveHintOptions): string {
  return [
    options.tone ?? "guide",
    options.double ? "1" : "0",
    options.half ? "1" : "0",
  ].join("|");
}

/**
 * 箭头排沿本地 Z（外法向）的位置。
 * 单层 / 中层：一排，落在高亮盒中面（与现网一致）。
 * 宽层 / 整机：每层一排，落在对应层中心，动画周期仍用同一 sideMs。
 */
function resolveArrowBeltOffsetsZ(
  kind: HintLayerKind,
  layerZ: number,
): number[] {
  const layerStep = MOVE_HINT_CUBE_EDGE / 3;
  if (kind === "wide") {
    // 外层 + 中层：相对魔方中心为 ±layerStep/沿外法向 1 与 0，再换到 group 本地 Z
    return [layerStep - MOVE_HINT_LAYER_OFFSET, -MOVE_HINT_LAYER_OFFSET];
  }
  if (kind === "whole") {
    return [layerStep, 0, -layerStep];
  }
  return [layerZ];
}

/**
 * 画 / 更新高亮。同一 move+options 时复用已有组，避免陀螺仪每帧重建导致箭头抖动。
 */
export function applyMoveHint(
  puzzle: HintHost,
  existing: Group | null,
  move: string | null,
  options: MoveHintOptions = {},
): Group | null {
  const optKey = hintOptionsKey(options);
  if (
    existing &&
    move &&
    (existing as HintGroup).userData.hintMove === move &&
    (existing as HintGroup).userData.hintOptionsKey === optKey
  ) {
    // alg 动画后旧 puzzle 可能已脱离场景；同一 move 也要挂回当前宿主。
    if (existing.parent !== puzzle) {
      existing.parent?.remove(existing);
      puzzle.remove(existing);
      puzzle.add(existing);
      puzzle.scheduleRenderCallback?.();
    }
    return existing;
  }
  if (existing) {
    existing.parent?.remove(existing);
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
  group.userData.hintMove = move;
  group.userData.hintOptionsKey = optKey;
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
/** 双步撇认 `2'`（cubing）与 `'2`（采集/联调，如 `r'2`）。 */
const WIDE_TURN = /^([udlrfb])(2'|'2|2|')?$/;
const SLICE_TURN = /^([MES])(2'|'2|2|')?$/;
/**
 * 中层高亮轴向：须与 WCA 同向参照一致，否则箭头会反。
 * M 同 L，E 同 D，S 同 F（不是 R / U）。
 */
const SLICE_AXIS_FACE: Record<"M" | "E" | "S", Face> = {
  M: "L",
  E: "D",
  S: "F",
};
const WIDE_TO_FACE: Record<string, Face> = {
  u: "U",
  d: "D",
  l: "L",
  r: "R",
  f: "F",
  b: "B",
};

function parseHintMove(
  move: string,
  options: MoveHintOptions,
): {
  face: Face;
  prime: boolean;
  double: boolean;
  half: boolean;
  kind: HintLayerKind;
} | null {
  const raw = move.trim();
  const faceMatch = FACE_TURN.exec(raw);
  if (faceMatch) {
    return {
      face: faceMatch[1] as Face,
      prime: Boolean(faceMatch[2]),
      double: Boolean(options.double) && !options.half,
      half: Boolean(options.half),
      kind: "outer",
    };
  }
  const rotMatch = ROTATION_TURN.exec(raw);
  if (rotMatch) {
    const axis = rotMatch[1] as "x" | "y" | "z";
    const suffix = rotMatch[2] ?? "";
    return {
      face: ROTATION_AXIS_FACE[axis],
      prime: suffix === "'",
      double: suffix === "2" || suffix === "2'" || Boolean(options.double),
      half: false,
      // 整机转体：空心盒包住整颗魔方。
      kind: "whole",
    };
  }
  const wideMatch = WIDE_TURN.exec(raw);
  if (wideMatch) {
    const family = wideMatch[1]!;
    const suffix = wideMatch[2] ?? "";
    return {
      face: WIDE_TO_FACE[family]!,
      prime: suffix === "'" || suffix === "'2" || suffix === "2'",
      double:
        suffix === "2" ||
        suffix === "2'" ||
        suffix === "'2" ||
        Boolean(options.double),
      half: Boolean(options.half),
      kind: "wide",
    };
  }
  const sliceMatch = SLICE_TURN.exec(raw);
  if (sliceMatch) {
    const family = sliceMatch[1] as "M" | "E" | "S";
    const suffix = sliceMatch[2] ?? "";
    return {
      face: SLICE_AXIS_FACE[family],
      prime: suffix === "'" || suffix === "'2" || suffix === "2'",
      double:
        suffix === "2" ||
        suffix === "2'" ||
        suffix === "'2" ||
        Boolean(options.double),
      half: Boolean(options.half),
      kind: "middle",
    };
  }
  return null;
}

function buildHintGroup(
  move: string,
  options: MoveHintOptions,
  onFrame: () => void,
): HintGroup | null {
  const parsed = parseHintMove(move, options);
  if (!parsed) {
    return null;
  }
  const { face, prime, double, half, kind } = parsed;
  const frame = FACE_FRAME[face];
  const tone = options.tone ?? "guide";
  const fillColor = FILL_COLORS[tone];
  const frameColor = FRAME_COLORS[tone];
  const travelSign = prime ? 1 : -1;

  const normal = new Vector3(...frame.normal).normalize();
  const up = new Vector3(...frame.up).normalize();
  const right = new Vector3().crossVectors(up, normal).normalize();
  const trueUp = new Vector3().crossVectors(normal, right).normalize();

  const faceSize =
    kind === "whole"
      ? MOVE_HINT_WHOLE_FACE
      : kind === "middle"
        ? MOVE_HINT_MIDDLE_FACE
        : MOVE_HINT_LAYER_FACE;
  const ringRadius =
    kind === "whole"
      ? MOVE_HINT_WHOLE_RING_RADIUS
      : kind === "middle"
        ? MOVE_HINT_MIDDLE_RING_RADIUS
        : MOVE_HINT_RING_RADIUS;
  const thick =
    kind === "whole"
      ? LAYER_THICK_WHOLE
      : kind === "wide"
        ? LAYER_THICK_WIDE
        : kind === "middle"
          ? LAYER_THICK_MIDDLE
          : LAYER_THICK_OUTER;
  // outer/wide：框在对应层外侧；middle/whole：框在立方体中心。
  const layerOffset =
    kind === "middle" || kind === "whole" ? 0 : MOVE_HINT_LAYER_OFFSET;
  const layerZ =
    kind === "middle" || kind === "whole"
      ? 0
      : MOVE_HINT_CUBE_RADIUS - thick / 2 - layerOffset;
  const sideMs = double ? MOVE_HINT_SIDE_MS * 0.8 : MOVE_HINT_SIDE_MS;
  // 轨迹与线速度对齐单层；描边仍可用各自 faceSize。
  const travelHalf = MOVE_HINT_TRAVEL_HALF;

  const group = new Group() as HintGroup;
  group.name = "cube-move-hint";
  group.userData.face = face;
  group.userData.layerKind = kind;
  if (kind === "middle" || kind === "whole") {
    group.position.set(0, 0, 0);
  } else {
    group.position.copy(normal.clone().multiplyScalar(layerOffset));
  }
  group.quaternion.setFromRotationMatrix(
    new Matrix4().makeBasis(right, trueUp, normal),
  );
  group.renderOrder = 20;

  // 中层与外层一样开 depthTest：只露在魔方外侧的箍，背面被贴纸挡住。
  const depthTest = true;

  const layer = buildLayerFrame(
    faceSize,
    thick,
    frameColor,
    FRAME_OPACITY,
    depthTest,
  );
  layer.position.z = layerZ;
  group.add(layer);

  const activeAngles = half
    ? ([0, Math.PI] as number[])
    : ([...SIDE_ANGLES] as number[]);
  const beltOffsetsZ = resolveArrowBeltOffsetsZ(kind, layerZ);

  const arrowGeom = createArrowGeometry(
    MOVE_HINT_ARROW_HALF_WIDTH,
    MOVE_HINT_ARROW_HALF_LEN,
  );
  const outlineGeom = createArrowGeometry(
    MOVE_HINT_ARROW_HALF_WIDTH * 1.28,
    MOVE_HINT_ARROW_HALF_LEN * 1.1,
  );
  const travelers: Group[] = [];
  const travelerAngles: number[] = [];
  for (let beltIndex = 0; beltIndex < beltOffsetsZ.length; beltIndex++) {
    const belt = new Group();
    belt.name =
      beltIndex === 0
        ? "cube-move-hint-arrow"
        : `cube-move-hint-arrow-${beltIndex}`;
    belt.position.z = beltOffsetsZ[beltIndex]!;
    belt.renderOrder = 22;
    for (let i = 0; i < activeAngles.length; i++) {
      const traveler = new Group();
      const globalIndex = travelers.length;
      traveler.name =
        globalIndex === 0
          ? "cube-move-hint-traveler"
          : `cube-move-hint-traveler-${globalIndex}`;
      const outline = new Mesh(
        outlineGeom,
        solidMaterial(0x2a5078, 0.55, depthTest),
      );
      outline.position.z = -0.001;
      outline.renderOrder = 23;
      traveler.add(outline);
      const head = new Mesh(
        arrowGeom,
        solidMaterial(fillColor, 0.98, depthTest),
      );
      head.name =
        globalIndex === 0
          ? "cube-move-hint-head"
          : `cube-move-hint-head-${globalIndex}`;
      head.renderOrder = 24;
      traveler.add(head);
      belt.add(traveler);
      travelers.push(traveler);
      travelerAngles.push(activeAngles[i]!);
    }
    group.add(belt);
  }

  group.userData.ringRadius = ringRadius;
  group.userData.depthTest = depthTest;
  group.userData.prime = prime;
  group.userData.double = double;
  group.userData.fillColor = fillColor;
  group.userData.sideMs = sideMs;
  group.userData.arrowBeltCount = beltOffsetsZ.length;
  group.userData.arrowCount = travelers.length;
  group.userData.travelHalf = travelHalf;

  const startedAt = performance.now();
  let raf = 0;
  const hasRaf = typeof requestAnimationFrame === "function";
  const tick = (now: number) => {
    const elapsed = now - startedAt;
    // 各排同步：同一周期、同一行程，线速度与单层一致
    const along = ((elapsed / sideMs) % 1) * 2 - 1;
    for (let i = 0; i < travelers.length; i++) {
      applySidePose(
        travelers[i]!,
        travelerAngles[i]!,
        travelSign,
        ringRadius + 0.01,
        along,
        travelHalf,
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
