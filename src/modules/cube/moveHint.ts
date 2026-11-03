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
 * 贴面弯箭头在对应面局部 XY 上绘制（VisualCube / twistysvg 风格）。
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

const FILL_COLORS: Record<MoveHintTone, number> = {
  guide: 0xffffff,
  error: 0xff6b4a,
};

const OUTLINE_COLORS: Record<MoveHintTone, number> = {
  guide: 0x1a2230,
  error: 0x5a180c,
};

export const MOVE_HINT_CUBE_EDGE = 3;
export const MOVE_HINT_CUBE_RADIUS = 1.5;
/** 贴面弧落在色块环上（略小于半宽，不压中心块）。 */
export const MOVE_HINT_RADIUS_SCALE = 0.82;
export const MOVE_HINT_RING_RADIUS =
  MOVE_HINT_CUBE_RADIUS * MOVE_HINT_RADIUS_SCALE;
/** 提示组略抬出面，避免与贴纸 z-fight。 */
export const MOVE_HINT_LAYER_OFFSET = MOVE_HINT_CUBE_RADIUS + 0.1;
/** 弯箭头半宽：细线更接近 VisualCube。 */
export const MOVE_HINT_TUBE_RADIUS = 0.07;

/** 厚层高亮：盖住要转的那一层，半透明但足够醒目。 */
const LAYER_FACE = MOVE_HINT_CUBE_EDGE + 0.08;
const LAYER_THICK = 1.08;
const LAYER_OPACITY = 0.34;
const ARROW_LIFT = 0.05;
const SHADOW_LIFT = 0.02;
const ARC_SEGMENTS = 64;
const ARC_SINGLE = Math.PI * 1.62;
const ARC_DOUBLE = Math.PI * 1.82;
const ARC_HALF = Math.PI * 0.92;
const HEAD_BASE_SCALE = 1.55;
const FLOW_PERIOD_MS = 1800;
const FLOW_CHEVRON_COUNT = 3;
const OUTLINE_EXTRA = 0.028;

type HintHost = {
  add(object: Group): void;
  remove(object: Group): void;
  scheduleRenderCallback?: () => void;
};

type HintGroup = Group & {
  userData: {
    stopAnim?: () => void;
    face?: Face;
    tipAngle?: number;
    tailAngle?: number;
    seamAngle?: number;
    ringRadius?: number;
    layerOffset?: number;
    depthTest?: boolean;
    double?: boolean;
    fillColor?: number;
    horizontal?: boolean;
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

function easeInOut(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 贴面扁环带：尾细头略宽，几乎无厚度。 */
function createFlatBandGeometry(
  ringRadius: number,
  halfWidth: number,
  tailAngle: number,
  arcLength: number,
  travelSign: number,
  segments: number,
  taper = 0.35,
): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segments; i++) {
    const u = i / segments;
    const angle = tailAngle + travelSign * u * arcLength;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const scale = 1 + taper * u;
    const hw = halfWidth * scale;
    positions.push(
      (ringRadius - hw) * cos,
      (ringRadius - hw) * sin,
      0,
      (ringRadius + hw) * cos,
      (ringRadius + hw) * sin,
      0,
    );
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new BufferAttribute(new Float32Array(positions), 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** VisualCube 风格三角箭头头：底宽、尖细。 */
function createFlatHeadGeometry(
  ringRadius: number,
  halfWidth: number,
  seamAngle: number,
  travelSign: number,
): BufferGeometry {
  const cos = Math.cos(seamAngle);
  const sin = Math.sin(seamAngle);
  const tx = -sin * travelSign;
  const ty = cos * travelSign;
  const base = halfWidth * HEAD_BASE_SCALE * 2.35;
  const height = base * 1.05;
  const cx = ringRadius * cos;
  const cy = ringRadius * sin;
  const bx = -ty;
  const by = tx;
  // 底座略嵌进弧带，接缝更干净
  const nest = halfWidth * 0.35;
  const baseX = cx - tx * nest;
  const baseY = cy - ty * nest;
  const tipX = baseX + tx * height;
  const tipY = baseY + ty * height;
  const positions = new Float32Array([
    tipX,
    tipY,
    0,
    baseX + bx * base,
    baseY + by * base,
    0,
    baseX - bx * base,
    baseY - by * base,
    0,
  ]);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();
  return geometry;
}

function createFlatChevronGeometry(halfWidth: number): BufferGeometry {
  const w = halfWidth * 1.05;
  const h = halfWidth * 1.55;
  const positions = new Float32Array([
    0,
    h,
    0,
    -w,
    -h * 0.4,
    0,
    0,
    -h * 0.08,
    0,
    0,
    h,
    0,
    0,
    -h * 0.08,
    0,
    w,
    -h * 0.4,
    0,
  ]);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
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
 * 厚层高亮 + VisualCube 风格贴面弯箭头。
 * 本地系：Z 朝外法向，XY 为面平面。
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
  const outlineColor = OUTLINE_COLORS[tone];
  const double = Boolean(options.double) && !options.half;
  const half = Boolean(options.half);
  const travelSign = prime ? 1 : -1;
  const arcLength = half ? ARC_HALF : double ? ARC_DOUBLE : ARC_SINGLE;

  const normal = new Vector3(...frame.normal).normalize();
  const up = new Vector3(...frame.up).normalize();
  const right = new Vector3().crossVectors(up, normal).normalize();
  const trueUp = new Vector3().crossVectors(normal, right).normalize();

  const ringRadius = MOVE_HINT_RING_RADIUS;
  const layerOffset = MOVE_HINT_LAYER_OFFSET;
  const halfWidth = MOVE_HINT_TUBE_RADIUS;

  const group = new Group() as HintGroup;
  group.name = "cube-move-hint";
  group.userData.face = face;
  group.position.copy(normal.clone().multiplyScalar(layerOffset));
  group.quaternion.setFromRotationMatrix(
    new Matrix4().makeBasis(right, trueUp, normal),
  );
  group.renderOrder = 20;

  const depthTest = false;

  // 厚层高亮：半透明盒子盖住要转的那一层
  const layer = new Mesh(
    new BoxGeometry(LAYER_FACE, LAYER_FACE, LAYER_THICK),
    solidMaterial(fillColor, LAYER_OPACITY, depthTest),
  );
  layer.name = "cube-move-hint-layer";
  layer.renderOrder = 18;
  layer.position.z = MOVE_HINT_CUBE_RADIUS - LAYER_THICK / 2 - layerOffset;
  group.add(layer);

  const arrows = new Group();
  arrows.name = "cube-move-hint-arrow";
  arrows.position.z = ARROW_LIFT;
  arrows.renderOrder = 22;

  const mid = Math.PI / 2;
  const halfArc = arcLength / 2;
  const tailAngle = mid - travelSign * halfArc;
  const tipAngle = mid + travelSign * halfArc;
  const headHalfWidth = halfWidth * 1.85;
  const headHeight = headHalfWidth * 2 * HEAD_BASE_SCALE * 0.58;
  const headAngle = headHeight / ringRadius;
  const seamAngle = tipAngle - travelSign * headAngle;
  const bandLength = Math.abs(seamAngle - tailAngle);

  const outlineMat = solidMaterial(outlineColor, 0.72, depthTest);
  const fillMat = solidMaterial(fillColor, 0.97, depthTest);
  const shadowMat = solidMaterial(0x000000, 0.18, depthTest);

  // 轻阴影，略偏尾侧
  const shadow = new Mesh(
    createFlatBandGeometry(
      ringRadius,
      halfWidth + OUTLINE_EXTRA * 1.4,
      tailAngle,
      bandLength,
      travelSign,
      ARC_SEGMENTS,
      0.4,
    ),
    shadowMat,
  );
  shadow.position.set(0.015, -0.02, SHADOW_LIFT - ARROW_LIFT);
  shadow.renderOrder = 19;
  arrows.add(shadow);

  const outline = new Mesh(
    createFlatBandGeometry(
      ringRadius,
      halfWidth + OUTLINE_EXTRA,
      tailAngle,
      bandLength,
      travelSign,
      ARC_SEGMENTS,
      0.4,
    ),
    outlineMat,
  );
  outline.renderOrder = 21;
  arrows.add(outline);

  const band = new Mesh(
    createFlatBandGeometry(
      ringRadius,
      halfWidth,
      tailAngle,
      bandLength,
      travelSign,
      ARC_SEGMENTS,
      0.4,
    ),
    fillMat,
  );
  band.renderOrder = 22;
  arrows.add(band);

  const headOutline = new Mesh(
    createFlatHeadGeometry(
      ringRadius,
      headHalfWidth + OUTLINE_EXTRA,
      seamAngle,
      travelSign,
    ),
    outlineMat,
  );
  headOutline.renderOrder = 23;
  arrows.add(headOutline);

  const head = new Mesh(
    createFlatHeadGeometry(ringRadius, headHalfWidth, seamAngle, travelSign),
    fillMat,
  );
  head.name = "cube-move-hint-head";
  head.renderOrder = 24;
  arrows.add(head);

  if (double) {
    const midHead = new Mesh(
      createFlatHeadGeometry(ringRadius, halfWidth * 1.35, mid, travelSign),
      fillMat,
    );
    midHead.renderOrder = 23;
    arrows.add(midHead);
    const midOutline = new Mesh(
      createFlatHeadGeometry(
        ringRadius,
        halfWidth * 1.35 + OUTLINE_EXTRA,
        mid,
        travelSign,
      ),
      outlineMat,
    );
    midOutline.renderOrder = 22;
    arrows.add(midOutline);
  }

  const chevronGeom = createFlatChevronGeometry(halfWidth);
  const chevrons: Array<{ mesh: Mesh; mat: MeshBasicMaterial }> = [];
  for (let i = 0; i < FLOW_CHEVRON_COUNT; i++) {
    const mat = solidMaterial(fillColor, 0.55, depthTest);
    const mesh = new Mesh(chevronGeom, mat);
    mesh.renderOrder = 25;
    arrows.add(mesh);
    chevrons.push({ mesh, mat });
  }

  group.add(arrows);

  const tipAnchor = new Object3D();
  tipAnchor.name = "cube-move-hint-tip";
  tipAnchor.position.set(
    ringRadius * Math.cos(tipAngle),
    ringRadius * Math.sin(tipAngle),
    ARROW_LIFT,
  );
  group.add(tipAnchor);

  group.userData.tipAngle = tipAngle;
  group.userData.tailAngle = tailAngle;
  group.userData.seamAngle = seamAngle;
  group.userData.ringRadius = ringRadius;
  group.userData.layerOffset = layerOffset;
  group.userData.depthTest = depthTest;
  group.userData.double = double;
  group.userData.fillColor = fillColor;
  group.userData.horizontal = face === "U" || face === "D";

  const startedAt = performance.now();
  let raf = 0;
  const hasRaf = typeof requestAnimationFrame === "function";
  const tick = (now: number) => {
    const elapsed = now - startedAt;
    const base = (elapsed / FLOW_PERIOD_MS) % 1;

    for (let i = 0; i < chevrons.length; i++) {
      const raw = (base + i / FLOW_CHEVRON_COUNT) % 1;
      const phase = easeInOut(raw);
      const angle = tailAngle + travelSign * bandLength * phase;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const tx = -sin * travelSign;
      const ty = cos * travelSign;
      const { mesh, mat } = chevrons[i]!;
      mesh.position.set(ringRadius * cos, ringRadius * sin, 0.002);
      mesh.quaternion.setFromUnitVectors(
        new Vector3(0, 1, 0),
        new Vector3(tx, ty, 0),
      );
      mat.opacity = 0.18 + 0.55 * phase;
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
